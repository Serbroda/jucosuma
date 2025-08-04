package main

import (
	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
	"net/http"
	"strconv"
	"time"
)

func (app *application) getContracts(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	json := utils.MapSlice(contracts, func(item sqlc.Contract) dtos.ContractDto {
		return dtos.MapContractToContractDto(item)
	})

	return ctx.JSON(http.StatusOK, json)
}

func (app *application) getContractById(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	contract, err := app.queries.FindContractById(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	json := dtos.MapContractToContractDto(contract)
	return ctx.JSON(http.StatusOK, json)
}

func (app *application) createContract(ctx echo.Context) error {
	var payload dtos.CreateContractDto
	if err := BindAndValidate(ctx, &payload); err != nil {
		return err
	}

	contract, err := app.queries.InsertContract(ctx.Request().Context(), sqlc.InsertContractParams{
		Name:           payload.Name,
		Company:        payload.Company,
		ContractType:   payload.ContractType,
		Category:       payload.Category,
		StartDate:      time.Time(payload.StartDate),
		EndDate:        (*time.Time)(payload.EndDate),
		ContractNumber: payload.ContractNumber,
		CustomerNumber: payload.CustomerNumber,
		Costs:          payload.Costs,
		BillingPeriod:  payload.BillingPeriod,
		IconSource:     payload.IconSource,
		Notes:          payload.Notes,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.JSON(http.StatusOK, dtos.MapContractToContractDto(contract))
}

func (app *application) updateContract(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var payload dtos.UpdateContractDto
	if err := BindAndValidate(ctx, &payload); err != nil {
		return err
	}

	err = app.queries.UpdateContractById(ctx.Request().Context(), sqlc.UpdateContractByIdParams{
		ID:             id,
		Name:           payload.Name,
		Company:        payload.Company,
		ContractType:   payload.ContractType,
		Category:       payload.Category,
		StartDate:      time.Time(payload.StartDate),
		EndDate:        (*time.Time)(payload.EndDate),
		ContractNumber: payload.ContractNumber,
		CustomerNumber: payload.CustomerNumber,
		Costs:          payload.Costs,
		BillingPeriod:  payload.BillingPeriod,
		IconSource:     payload.IconSource,
		Notes:          payload.Notes,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.String(http.StatusOK, "successfully updated")
}

func (app *application) deleteContract(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	err = app.queries.DeleteContractSoft(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.String(http.StatusOK, "successfully deleted")
}

func (app *application) searchLogos(ctx echo.Context) error {
	term := ctx.QueryParam("term")
	if term == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "term is required")
	}

	results, err := utils.SearchAppLogos(term)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var logos []dtos.LogoDto
	for _, res := range results {
		logos = append(logos, dtos.LogoDto{
			Name: res.TrackName,
			Logo: res.ArtworkUrl100,
		})
	}
	return ctx.JSON(http.StatusOK, logos)
}
