package main

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

func (app *application) exportContractsJSON(ctx echo.Context) error {
	user := ctx.Get("user").(sqlc.User)
	contracts, err := app.queries.FindContractsForUser(ctx.Request().Context(), &user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	contractDtos, err := app.mapContracts(ctx.Request().Context(), contracts)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := app.withContactData(ctx.Request().Context(), contractDtos); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

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

	persons, err := app.personsById(ctx, qtx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	categories, err := app.loadCategories(ctx, qtx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	imported := 0
	for _, p := range contracts {
		if p.BillingPeriod == "" {
			p.BillingPeriod = string(dtos.BillingPeriodNone)
		}
		billingPeriod, intervalCount, intervalUnit, err := billingInterval(p.BillingPeriod, p.IntervalCount, p.IntervalUnit)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "'"+p.Name+"': "+err.Error())
		}

		targetAccountID, goalID := p.TargetAccountID, p.GoalID
		if p.Kind != dtos.EntryKindTransfer {
			targetAccountID, goalID = nil, nil
		}

		categoryID, categoryName := categories.categoryParams(p.CategoryID, p.Category, normalizeKind(p.Kind))
		website, err := normalizeOptionalURL(p.Website)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "'"+p.Name+"': "+err.Error())
		}
		inserted, err := qtx.InsertContract(ctx, sqlc.InsertContractParams{
			Name:            p.Name,
			Company:         p.Company,
			Category:        categoryName,
			CategoryID:      categoryID,
			IsContract:      boolToInt64(p.IsContract && normalizeKind(p.Kind) == "EXPENSE"),
			IsVariable:      boolToInt64(p.Variable() && normalizeKind(p.Kind) == "EXPENSE"),
			TermMonths:      p.TermMonths,
			NoticePeriod:    p.NoticePeriod,
			NoticeUnit:      noticeUnit(p.NoticePeriod, p.NoticeUnit),
			StartDate:       time.Time(p.StartDate),
			EndDate:         (*time.Time)(p.EndDate),
			ContractNumber:  p.ContractNumber,
			CustomerNumber:  p.CustomerNumber,
			ContractHolder:  p.ContractHolder,
			BillingPeriod:   billingPeriod,
			IntervalCount:   intervalCount,
			IntervalUnit:    intervalUnit,
			Costs:           importBaseCosts(p),
			Currency:        p.Currency,
			NextBillingDate: (*time.Time)(p.NextBillingDate),
			ContactPerson:   p.ContactPerson,
			ContactAddress:  p.ContactAddress,
			ContactPhone:    p.ContactPhone,
			ContactEmail:    p.ContactEmail,
			Website:         website,
			IconSource:      p.IconSource,
			Notes:           p.Notes,
			OwnerID:         p.OwnerID,
			SplitBetween:    maxInt64(p.SplitBetween, 1),
			Kind:            normalizeKind(p.Kind),
			AccountID:       p.AccountID,
			TargetAccountID: targetAccountID,
			GoalID:          goalID,
			TransferType:    transferType(p.Kind, p.TransferType),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to import contract '"+p.Name+"': "+err.Error())
		}
		if err := replaceContractShares(ctx, qtx, inserted.ID, p.Shares, persons); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to import shares of '"+p.Name+"': "+err.Error())
		}
		for _, a := range p.Amounts {
			if err := qtx.UpsertContractAmount(ctx, sqlc.UpsertContractAmountParams{
				ContractID: inserted.ID, ValidFrom: time.Time(a.ValidFrom), Costs: a.Costs,
			}); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to import amounts of '"+p.Name+"': "+err.Error())
			}
		}
		if p.Links != nil {
			if err := replaceContractLinks(ctx, qtx, inserted.ID, *p.Links); err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "'"+p.Name+"': "+err.Error())
			}
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

// importBaseCosts returns the amount from the start date: exports with an amount history carry
// today's amount in "costs" and the start amount in "base_costs".
func importBaseCosts(p dtos.CreateContractDto) *float64 {
	if len(p.Amounts) > 0 && p.BaseCosts != nil {
		return p.BaseCosts
	}
	return p.Costs
}
