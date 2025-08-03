package main

import (
	"github.com/labstack/echo/v4"
	"net/http"
	"strconv"
)

func (app *application) getContracts(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, contracts)
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
	return ctx.JSON(http.StatusOK, contract)
}
