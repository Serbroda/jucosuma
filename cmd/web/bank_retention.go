package main

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

const (
	settingBankRawRetention = "bank_raw_retention_months"
	bankRawRetentionDefault = 3
)

// bankRetentionMonths is how long the raw details of closed imports are kept.
func (app *application) bankRetentionMonths(ctx context.Context) int {
	if v, err := app.queries.FindAppSetting(ctx, settingBankRawRetention); err == nil {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			return n
		}
	}
	return bankRawRetentionDefault
}

// purgeBankDetails removes counterparty, purpose and references of imports closed longer than the
// retention ago. Date, amount, classification and fingerprint stay, so totals and duplicate
// detection keep working.
func (app *application) purgeBankDetails(ctx context.Context) error {
	closedBefore := time.Now().UTC().AddDate(0, -app.bankRetentionMonths(ctx), 0)
	if app.bankRetentionMonths(ctx) == 0 {
		// closed just now counts as well
		closedBefore = time.Now().UTC().Add(time.Minute)
	}
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)
	rows, err := qtx.PurgeBankTransactions(ctx, &closedBefore)
	if err != nil {
		return err
	}
	if _, err := qtx.MarkBankImportsPurged(ctx, &closedBefore); err != nil {
		return err
	}
	if rows > 0 {
		log.Printf("removed the details of %d bank bookings of closed imports", rows)
	}
	return tx.Commit()
}

// startBankPurge removes expired details once at start and then daily.
func (app *application) startBankPurge() {
	go func() {
		for {
			if err := app.purgeBankDetails(context.Background()); err != nil {
				log.Printf("purging bank details failed: %v", err)
			}
			time.Sleep(24 * time.Hour)
		}
	}()
}

func (app *application) getBankSettings(c echo.Context) error {
	return c.JSON(http.StatusOK, dtos.BankSettingsDto{RawRetentionMonths: app.bankRetentionMonths(c.Request().Context())})
}

func (app *application) saveBankSettings(c echo.Context) error {
	var payload dtos.BankSettingsDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	ctx := c.Request().Context()
	if err := app.queries.UpsertAppSetting(ctx, sqlc.UpsertAppSettingParams{Key: settingBankRawRetention, Value: strconv.Itoa(payload.RawRetentionMonths)}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := app.purgeBankDetails(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, payload)
}
