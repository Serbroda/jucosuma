package main

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

func (app *application) getMonthClosings(c echo.Context) error {
	ctx := c.Request().Context()
	closings, err := app.queries.FindAllMonthClosings(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	balances, err := app.queries.FindAllMonthClosingBalances(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	actuals, err := app.queries.FindAllMonthClosingActuals(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	balancesByClosing := map[int64][]dtos.ClosingBalanceDto{}
	for _, b := range balances {
		balancesByClosing[b.ClosingID] = append(balancesByClosing[b.ClosingID], dtos.ClosingBalanceDto{AccountID: b.AccountID, Balance: b.Balance})
	}
	actualsByClosing := map[int64][]dtos.ClosingActualDto{}
	for _, a := range actuals {
		actualsByClosing[a.ClosingID] = append(actualsByClosing[a.ClosingID], dtos.ClosingActualDto{CategoryID: a.CategoryID, Amount: a.Amount})
	}

	return c.JSON(http.StatusOK, utils.MapSlice(closings, func(m sqlc.MonthClosing) dtos.MonthClosingDto {
		return dtos.MonthClosingDto{
			ID:        m.ID,
			Month:     m.Month,
			Notes:     m.Notes,
			CreatedBy: m.CreatedBy,
			CreatedAt: m.CreatedAt,
			UpdatedAt: m.UpdatedAt,
			Balances:  orEmpty(balancesByClosing[m.ID]),
			Actuals:   orEmpty(actualsByClosing[m.ID]),
		}
	}))
}

// saveMonthClosing creates or replaces the closing of a month. When it is the latest closing,
// the account balances are updated to the balances at the end of that month.
func (app *application) saveMonthClosing(c echo.Context) error {
	month := c.Param("month")
	if !monthPattern.MatchString(month) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month, expected YYYY-MM")
	}
	var payload dtos.SaveMonthClosingDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	user := c.Get("user").(sqlc.User)

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	closing, err := qtx.FindMonthClosingByMonth(ctx, month)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		closing, err = qtx.InsertMonthClosing(ctx, sqlc.InsertMonthClosingParams{Month: month, Notes: utils.TrimToNil(payload.Notes), CreatedBy: &user.ID})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	default:
		if err := qtx.UpdateMonthClosingNotes(ctx, sqlc.UpdateMonthClosingNotesParams{ID: closing.ID, Notes: utils.TrimToNil(payload.Notes)}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}

	if err := replaceClosingValues(ctx, qtx, closing.ID, payload); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	latest, err := qtx.FindLatestMonthClosing(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if latest.ID == closing.ID {
		monthStart, _ := time.Parse("2006-01", month)
		monthEnd := monthStart.AddDate(0, 1, -1)
		for _, b := range payload.Balances {
			if err := qtx.UpdateAccountBalance(ctx, sqlc.UpdateAccountBalanceParams{ID: b.AccountID, Balance: &b.Balance, BalanceDate: &monthEnd}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func replaceClosingValues(ctx context.Context, q *sqlc.Queries, closingID int64, payload dtos.SaveMonthClosingDto) error {
	if err := q.DeleteMonthClosingBalances(ctx, closingID); err != nil {
		return err
	}
	for _, b := range payload.Balances {
		if err := q.InsertMonthClosingBalance(ctx, sqlc.InsertMonthClosingBalanceParams{ClosingID: closingID, AccountID: b.AccountID, Balance: b.Balance}); err != nil {
			return err
		}
	}
	if err := q.DeleteMonthClosingActuals(ctx, closingID); err != nil {
		return err
	}
	for _, a := range payload.Actuals {
		if err := q.InsertMonthClosingActual(ctx, sqlc.InsertMonthClosingActualParams{ClosingID: closingID, CategoryID: a.CategoryID, Amount: a.Amount}); err != nil {
			return err
		}
	}
	return nil
}

func (app *application) deleteMonthClosing(c echo.Context) error {
	closing, err := app.queries.FindMonthClosingByMonth(c.Request().Context(), c.Param("month"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "closing not found")
	}
	if err := app.queries.DeleteMonthClosing(c.Request().Context(), closing.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func orEmpty[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}
