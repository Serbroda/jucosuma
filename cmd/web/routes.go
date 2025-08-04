package main

import (
	"github.com/Serbroda/contracts/ui"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func (app *application) routes() *echo.Echo {
	e := echo.New()
	e.Validator = &CustomValidator{validator: validator.New()}
	e.Use(middleware.CORS())

	ui.RegisterUi(e)

	e.GET("/api/contracts", app.getContracts)
	e.POST("/api/contracts", app.createContract)
	e.GET("/api/contracts/:id", app.getContractById)
	e.PUT("/api/contracts/:id", app.updateContract)
	e.GET("/api/logos", app.searchLogos)

	return e
}
