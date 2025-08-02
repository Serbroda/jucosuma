package main

import (
	"github.com/Serbroda/contracts/ui"
	"github.com/labstack/echo/v4"
	"net/http"
)

func (app *application) routes() *echo.Echo {
	e := echo.New()

	ui.RegisterUi(e)

	e.GET("/api/contracts", app.getContracts)

	return e
}

func (app *application) getContracts(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, contracts)
}
