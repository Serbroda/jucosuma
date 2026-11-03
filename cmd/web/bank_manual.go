package main

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// Bookings entered by hand (e.g. cash spending) belong to no import. Only they can be edited and
// deleted; imported bookings stay as the bank delivered them.

type manualBooking struct {
	accountID    *int64
	date         time.Time
	amount       float64
	counterparty string
	purpose      string
	categoryID   *int64
	classifiedBy *string
}

// checkManualBooking validates the account and the assignment of a manual booking.
func (app *application) checkManualBooking(ctx context.Context, user sqlc.User, p dtos.SaveManualBankTransactionDto) (manualBooking, error) {
	b := manualBooking{
		accountID: p.AccountID, date: time.Time(*p.BookingDate), amount: math.Round(p.Amount*100) / 100,
		counterparty: strings.TrimSpace(p.Counterparty), purpose: strings.TrimSpace(p.Purpose),
	}
	if b.counterparty == "" {
		return b, echo.NewHTTPError(http.StatusBadRequest, "description is required")
	}
	if p.AccountID != nil {
		account, err := app.findAccount(ctx, *p.AccountID)
		if err != nil {
			return b, err
		}
		if err := app.ensureOwnOrSharedAccount(ctx, account, user.ID); err != nil {
			return b, err
		}
	}
	categoryID, err := app.bankTarget(ctx, user, p.CategoryID, p.ContractID)
	if err != nil {
		return b, err
	}
	b.categoryID = categoryID
	if categoryID != nil {
		manual := "MANUAL"
		b.classifiedBy = &manual
	}
	return b, nil
}

func (app *application) findAccount(ctx context.Context, id int64) (sqlc.Account, error) {
	accounts, err := app.queries.FindAllAccounts(ctx)
	if err != nil {
		return sqlc.Account{}, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	for _, a := range accounts {
		if a.ID == id {
			return a, nil
		}
	}
	return sqlc.Account{}, echo.NewHTTPError(http.StatusBadRequest, "unknown account")
}

func (app *application) createManualBankTransaction(c echo.Context) error {
	var payload dtos.SaveManualBankTransactionDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	b, err := app.checkManualBooking(ctx, user, payload)
	if err != nil {
		return err
	}
	created, err := app.queries.InsertManualBankTransaction(ctx, sqlc.InsertManualBankTransactionParams{
		OwnerID: user.ID, AccountID: b.accountID, Fingerprint: "manual:" + uuid.NewString(), BookingDate: b.date,
		Counterparty: b.counterparty, Purpose: b.purpose, Amount: b.amount, Currency: "EUR", Scope: payload.Scope,
		CategoryID: b.categoryID, ContractID: payload.ContractID, ClassifiedBy: b.classifiedBy,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, mapBankTransaction(created))
}

func (app *application) updateManualBankTransaction(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var payload dtos.SaveManualBankTransactionDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	user := c.Get("user").(sqlc.User)
	ctx := c.Request().Context()
	b, err := app.checkManualBooking(ctx, user, payload)
	if err != nil {
		return err
	}
	rows, err := app.queries.UpdateManualBankTransaction(ctx, sqlc.UpdateManualBankTransactionParams{
		ID: id, OwnerID: user.ID, AccountID: b.accountID, BookingDate: b.date, Counterparty: b.counterparty,
		Purpose: b.purpose, Amount: b.amount, Scope: payload.Scope, CategoryID: b.categoryID,
		ContractID: payload.ContractID, ClassifiedBy: b.classifiedBy,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "booking not found or imported")
	}
	return c.NoContent(http.StatusNoContent)
}

func (app *application) deleteManualBankTransaction(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	user := c.Get("user").(sqlc.User)
	rows, err := app.queries.DeleteManualBankTransaction(c.Request().Context(), sqlc.DeleteManualBankTransactionParams{ID: id, OwnerID: user.ID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "booking not found or imported")
	}
	return c.NoContent(http.StatusNoContent)
}
