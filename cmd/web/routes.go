package main

import (
	"github.com/Serbroda/contracts/ui"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func (app *application) routes() *echo.Echo {
	e := echo.New()
	e.Use(middleware.CORS())

	ui.RegisterUi(e)

	e.GET("/api/contracts", app.getContracts)

	return e
}
