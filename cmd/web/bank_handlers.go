package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	"github.com/Serbroda/contracts/internal/bankimport"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

// importBankStatement reads an exported bank statement. The account is taken from the form or
// matched by IBAN; with preview=true nothing is stored. Bookings already imported for the account
// (by anyone) are skipped without revealing them.
func (app *application) importBankStatement(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "missing file")
	}
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "cannot open file")
	}
	defer src.Close()
	data, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "cannot read file")
	}

	stmt, err := bankimport.Parse(data, file.Filename)
	if errors.Is(err, bankimport.ErrUnknownFormat) {
		return echo.NewHTTPError(http.StatusBadRequest, "unknown bank statement format (supported: ING)")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	preview := c.FormValue("preview") == "true"

	result := dtos.BankImportResultDto{
		Bank: stmt.Bank, Iban: stmt.IBAN, Balance: stmt.Balance, Total: len(stmt.Transactions),
		PeriodFrom: dateOnlyPtr(stmt.From), PeriodTo: dateOnlyPtr(stmt.To),
	}
	account, err := app.importAccount(ctx, c.FormValue("account_id"), stmt.IBAN, user.ID)
	if err != nil {
		return err
	}
	if account == nil {
		// the client lets the user pick the account and sends the file again
		return c.JSON(http.StatusOK, result)
	}
	result.AccountID = &account.ID
	// shared accounts count for the household by default, private accounts only for their owner
	result.Scope = "PRIVATE"
	if account.PersonID == nil {
		result.Scope = "HOUSEHOLD"
	}

	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	imp, err := qtx.InsertBankImport(ctx, sqlc.InsertBankImportParams{
		OwnerID: user.ID, AccountID: account.ID, Bank: stmt.Bank, Filename: file.Filename,
		PeriodFrom: stmt.From, PeriodTo: stmt.To,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	for i, fp := range bankimport.Fingerprints(stmt.Transactions) {
		exists, err := qtx.ExistsBankTransaction(ctx, sqlc.ExistsBankTransactionParams{AccountID: account.ID, Fingerprint: fp})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		if exists > 0 {
			result.Duplicates++
			continue
		}
		t := stmt.Transactions[i]
		if err := qtx.InsertBankTransaction(ctx, sqlc.InsertBankTransactionParams{
			ImportID: imp.ID, OwnerID: user.ID, AccountID: account.ID, Fingerprint: fp,
			BookingDate: t.BookingDate, ValueDate: t.ValueDate, Counterparty: t.Counterparty,
			CounterpartyIban: utils.TrimToNil(&t.CounterpartyIBAN), BookingText: t.BookingText, Purpose: t.Purpose,
			Reference: utils.TrimToNil(&t.Reference), CreditorID: utils.TrimToNil(&t.CreditorID),
			Amount: t.Amount, BalanceAfter: t.Balance, Currency: t.Currency, Scope: result.Scope,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		result.Imported++
	}

	if preview {
		return c.JSON(http.StatusOK, result)
	}
	if err := qtx.UpdateBankImportCounts(ctx, sqlc.UpdateBankImportCountsParams{
		ID: imp.ID, Imported: int64(result.Imported), Duplicates: int64(result.Duplicates),
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	result.ImportID = &imp.ID
	return c.JSON(http.StatusCreated, result)
}

// importAccount resolves the target account from an explicit id or the statement's IBAN. Accounts
// of another person with a login are refused: their statements are theirs to import.
func (app *application) importAccount(ctx context.Context, accountID, iban string, userID int64) (*sqlc.Account, error) {
	accounts, err := app.queries.FindAllAccounts(ctx)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	var account *sqlc.Account
	if accountID != "" {
		id, err := strconv.ParseInt(accountID, 10, 64)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid account_id")
		}
		for i := range accounts {
			if accounts[i].ID == id {
				account = &accounts[i]
			}
		}
		if account == nil {
			return nil, echo.NewHTTPError(http.StatusBadRequest, "unknown account")
		}
	} else if iban != "" {
		for i := range accounts {
			if accounts[i].Iban != nil && strings.EqualFold(*accounts[i].Iban, iban) {
				account = &accounts[i]
			}
		}
	}
	if account == nil || account.PersonID == nil {
		return account, nil
	}

	persons, err := app.queries.FindAllPersons(ctx)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	for _, p := range persons {
		if p.ID == *account.PersonID && p.UserID != nil && *p.UserID != userID {
			return nil, echo.NewHTTPError(http.StatusForbidden, "this account belongs to "+p.Name)
		}
	}
	return account, nil
}

func (app *application) getBankImports(c echo.Context) error {
	user := c.Get("user").(sqlc.User)
	imports, err := app.queries.FindBankImportsByOwner(c.Request().Context(), user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(imports, func(i sqlc.BankImport) dtos.BankImportDto {
		return dtos.BankImportDto{
			ID: i.ID, AccountID: i.AccountID, Bank: i.Bank, Filename: i.Filename,
			PeriodFrom: dateOnlyPtr(i.PeriodFrom), PeriodTo: dateOnlyPtr(i.PeriodTo),
			Imported: i.Imported, Duplicates: i.Duplicates, CreatedAt: i.CreatedAt,
		}
	}))
}

// deleteBankImport removes an import with all its bookings, e.g. after picking the wrong account.
func (app *application) deleteBankImport(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	if _, err := app.queries.FindBankImportByIdAndOwner(ctx, sqlc.FindBankImportByIdAndOwnerParams{ID: id, OwnerID: user.ID}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "import not found")
	}
	if err := app.queries.DeleteBankImport(ctx, sqlc.DeleteBankImportParams{ID: id, OwnerID: user.ID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// getBankTransactions lists the own bookings of a month (YYYY-MM).
func (app *application) getBankTransactions(c echo.Context) error {
	month := c.QueryParam("month")
	if !monthPattern.MatchString(month) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month, expected YYYY-MM")
	}
	from, _ := time.Parse("2006-01", month)
	user := c.Get("user").(sqlc.User)
	transactions, err := app.queries.FindBankTransactionsByOwner(c.Request().Context(), sqlc.FindBankTransactionsByOwnerParams{
		OwnerID: user.ID, DateFrom: from, DateTo: from.AddDate(0, 1, 0),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(transactions, func(t sqlc.BankTransaction) dtos.BankTransactionDto {
		return dtos.BankTransactionDto{
			ID: t.ID, ImportID: t.ImportID, AccountID: t.AccountID,
			BookingDate: dtos.DateOnly(t.BookingDate), ValueDate: dtos.DateOnly(t.ValueDate),
			Counterparty: t.Counterparty, CounterpartyIban: t.CounterpartyIban, BookingText: t.BookingText,
			Purpose: t.Purpose, Reference: t.Reference, Amount: t.Amount, BalanceAfter: t.BalanceAfter,
			Currency: t.Currency, Scope: t.Scope, Kind: t.Kind, CategoryID: t.CategoryID,
			ContractID: t.ContractID, ClassifiedBy: t.ClassifiedBy,
		}
	}))
}

func dateOnlyPtr(t *time.Time) *dtos.DateOnly {
	if t == nil {
		return nil
	}
	d := dtos.DateOnly(*t)
	return &d
}
