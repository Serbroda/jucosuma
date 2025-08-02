package main

import (
	"github.com/Serbroda/contracts/ui"
	"github.com/labstack/echo/v4"
)

func (app *application) routes() *echo.Echo {
	e := echo.New()

	ui.RegisterUi(e)

	e.GET("/api/contracts", app.getContracts)

	return e
}
