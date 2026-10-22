package main

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

// currentAmount returns the amount change valid today, or nil if the base amount applies.
// amounts must be sorted by valid_from.
func currentAmount(amounts []sqlc.ContractAmount) *sqlc.ContractAmount {
	now := time.Now()
	var current *sqlc.ContractAmount
	for i := range amounts {
		if !amounts[i].ValidFrom.After(now) {
			current = &amounts[i]
		}
	}
	return current
}

// accessibleContract loads the contract of the :id parameter if the user may see it.
func (app *application) accessibleContract(c echo.Context) (sqlc.Contract, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return sqlc.Contract{}, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	contract, err := app.queries.FindContractById(c.Request().Context(), id)
	if err != nil || !canAccess(c.Get("user").(sqlc.User), contract) {
		return sqlc.Contract{}, echo.NewHTTPError(http.StatusNotFound, "contract not found")
	}
	return contract, nil
}

// saveContractAmount records an amount change from a date on. A date on or before the start
// date changes the base amount instead.
func (app *application) saveContractAmount(c echo.Context) error {
	contract, err := app.accessibleContract(c)
	if err != nil {
		return err
	}
	var payload dtos.SaveContractAmountDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	validFrom := time.Time(payload.ValidFrom)
	if validFrom.IsZero() {
		return echo.NewHTTPError(http.StatusBadRequest, "valid_from is required")
	}

	ctx := c.Request().Context()
	if !validFrom.After(contract.StartDate) {
		err = app.queries.UpdateContractBaseCosts(ctx, sqlc.UpdateContractBaseCostsParams{Costs: payload.Costs, ID: contract.ID})
	} else {
		err = app.queries.UpsertContractAmount(ctx, sqlc.UpsertContractAmountParams{
			ContractID: contract.ID, ValidFrom: validFrom, Costs: *payload.Costs,
		})
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func (app *application) deleteContractAmount(c echo.Context) error {
	contract, err := app.accessibleContract(c)
	if err != nil {
		return err
	}
	amountID, err := strconv.ParseInt(c.Param("amountId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid amount id")
	}
	if err := app.queries.DeleteContractAmount(c.Request().Context(), sqlc.DeleteContractAmountParams{ID: amountID, ContractID: contract.ID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// updateContractAmount changes date and amount of an existing amount change. The date must stay
// after the start date; the start amount itself is changed via saveContractAmount.
func (app *application) updateContractAmount(c echo.Context) error {
	contract, err := app.accessibleContract(c)
	if err != nil {
		return err
	}
	amountID, err := strconv.ParseInt(c.Param("amountId"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid amount id")
	}
	var payload dtos.SaveContractAmountDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	validFrom := time.Time(payload.ValidFrom)
	if !validFrom.After(contract.StartDate) {
		return echo.NewHTTPError(http.StatusBadRequest, "valid_from must be after the start date")
	}
	err = app.queries.UpdateContractAmount(c.Request().Context(), sqlc.UpdateContractAmountParams{
		ValidFrom: validFrom, Costs: *payload.Costs, ID: amountID, ContractID: contract.ID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return echo.NewHTTPError(http.StatusConflict, "an amount change for this date already exists")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}
