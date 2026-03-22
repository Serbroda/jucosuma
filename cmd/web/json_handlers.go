package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

func (app *application) exportContractsJSON(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	contractDtos := utils.MapSlice(contracts, dtos.MapContractToContractDto)

	ctx.Response().Header().Set("Content-Type", "application/json")
	ctx.Response().Header().Set("Content-Disposition", "attachment; filename=contracts.json")

	return ctx.JSON(http.StatusOK, contractDtos)
}

func (app *application) importContractsJSON(c echo.Context) error {
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot read body")
	}

	var contracts []dtos.CreateContractDto
	if err := json.Unmarshal(body, &contracts); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid JSON: "+err.Error())
	}

	preview := c.QueryParam("preview") == "true"
	if preview {
		return c.JSON(http.StatusOK, map[string]any{
			"rows":     contracts,
			"imported": 0,
			"errors":   0,
		})
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	qtx := app.queries.WithTx(tx)

	imported := 0
	for _, p := range contracts {
		billingPeriod := strings.ToUpper(p.BillingPeriod)
		if billingPeriod == "" {
			billingPeriod = "NONE"
		}

		_, err := qtx.InsertContract(ctx, sqlc.InsertContractParams{
			Name:            p.Name,
			Company:         p.Company,
			Category:        p.Category,
			StartDate:       time.Time(p.StartDate),
			EndDate:         (*time.Time)(p.EndDate),
			ContractNumber:  p.ContractNumber,
			CustomerNumber:  p.CustomerNumber,
			ContractHolder:  p.ContractHolder,
			BillingPeriod:   billingPeriod,
			Costs:           p.Costs,
			Currency:        p.Currency,
			NextBillingDate: (*time.Time)(p.NextBillingDate),
			ContactPerson:   p.ContactPerson,
			ContactAddress:  p.ContactAddress,
			ContactPhone:    p.ContactPhone,
			ContactEmail:    p.ContactEmail,
			IconSource:      p.IconSource,
			Notes:           p.Notes,
			OwnerID:         p.OwnerID,
			SplitBetween:    maxInt64(p.SplitBetween, 1),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to import contract '"+p.Name+"': "+err.Error())
		}
		imported++
	}

	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{
		"imported": imported,
		"errors":   0,
	})
}
