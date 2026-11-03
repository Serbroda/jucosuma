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
	ctx := c.Request().Context()
	imports, err := app.queries.FindBankImportsByOwner(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	retention := app.bankRetentionMonths(ctx)
	return c.JSON(http.StatusOK, utils.MapSlice(imports, func(i sqlc.FindBankImportsByOwnerRow) dtos.BankImportDto {
		dto := dtos.BankImportDto{
			ID: i.ID, AccountID: i.AccountID, Bank: i.Bank, Filename: i.Filename,
			PeriodFrom: dateOnlyPtr(i.PeriodFrom), PeriodTo: dateOnlyPtr(i.PeriodTo),
			Imported: i.Imported, Duplicates: i.Duplicates, CreatedAt: i.CreatedAt,
			Total: i.Total, Classified: i.Classified, ClosedAt: i.ClosedAt, PurgedAt: i.PurgedAt,
		}
		if i.ClosedAt != nil && i.PurgedAt == nil {
			on := i.ClosedAt.AddDate(0, retention, 0)
			dto.PurgeOn = dateOnlyPtr(&on)
		}
		return dto
	}))
}

// closeBankImport marks an import as done: it leaves the list of imports to check. Bookings without
// category stay unassigned. With a retention of 0 months the raw details are removed right away.
func (app *application) closeBankImport(c echo.Context) error {
	return app.setBankImportClosed(c, true)
}

// reopenBankImport brings a closed import back, as long as its details have not been removed.
func (app *application) reopenBankImport(c echo.Context) error {
	return app.setBankImportClosed(c, false)
}

func (app *application) setBankImportClosed(c echo.Context, closed bool) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	var rows int64
	if closed {
		rows, err = app.queries.CloseBankImport(ctx, sqlc.CloseBankImportParams{ID: id, OwnerID: user.ID})
	} else {
		rows, err = app.queries.ReopenBankImport(ctx, sqlc.ReopenBankImportParams{ID: id, OwnerID: user.ID})
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if rows == 0 {
		return echo.NewHTTPError(http.StatusConflict, "import not found, already closed or its details were removed")
	}
	if closed && app.bankRetentionMonths(ctx) == 0 {
		if err := app.purgeBankDetails(ctx); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}
	return c.NoContent(http.StatusNoContent)
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

// getBankTransactions lists the own bookings of an import (import_id) or of a month (YYYY-MM).
func (app *application) getBankTransactions(c echo.Context) error {
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	var transactions []sqlc.BankTransaction
	var err error
	if importID := c.QueryParam("import_id"); importID != "" {
		id, perr := strconv.ParseInt(importID, 10, 64)
		if perr != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid import_id")
		}
		transactions, err = app.queries.FindBankTransactionsByImport(ctx, sqlc.FindBankTransactionsByImportParams{OwnerID: user.ID, ImportID: id})
	} else {
		month := c.QueryParam("month")
		if !monthPattern.MatchString(month) {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid month, expected YYYY-MM")
		}
		from, _ := time.Parse("2006-01", month)
		transactions, err = app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{
			OwnerID: user.ID, DateFrom: from, DateTo: from.AddDate(0, 1, 0),
		})
	}
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

// updateBankTransactions sets the scope and/or the category of own bookings. Bookings of other users
// are silently not touched, so ids reveal nothing.
func (app *application) updateBankTransactions(c echo.Context) error {
	var payload dtos.UpdateBankTransactionsDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	if payload.ContractID != nil {
		contract, err := app.queries.FindContractById(ctx, *payload.ContractID)
		if err != nil || !canAccess(user, contract) {
			return echo.NewHTTPError(http.StatusBadRequest, "unknown entry")
		}
		if contract.CategoryID == nil {
			return echo.NewHTTPError(http.StatusBadRequest, "the entry has no category")
		}
		payload.CategoryID = contract.CategoryID
	} else if payload.CategoryID != nil {
		if _, err := app.queries.FindCategoryById(ctx, *payload.CategoryID); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "unknown category")
		}
	}
	setCategory := payload.CategoryID != nil || payload.ClearCategory
	if payload.Scope == nil && !setCategory {
		return echo.NewHTTPError(http.StatusBadRequest, "nothing to update")
	}
	var classifiedBy *string
	if payload.CategoryID != nil {
		manual := "MANUAL"
		classifiedBy = &manual
	}

	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)
	for _, id := range payload.IDs {
		if payload.Scope != nil {
			if _, err := qtx.UpdateBankTransactionScope(ctx, sqlc.UpdateBankTransactionScopeParams{ID: id, OwnerID: user.ID, Scope: *payload.Scope}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
			}
		}
		if setCategory {
			if _, err := qtx.UpdateBankTransactionCategory(ctx, sqlc.UpdateBankTransactionCategoryParams{
				ID: id, OwnerID: user.ID, CategoryID: payload.CategoryID, ContractID: payload.ContractID, ClassifiedBy: classifiedBy,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
