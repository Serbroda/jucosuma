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
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.BodyLimit("20M"))

	ui.RegisterUi(e)
	e.Static("/uploads", app.uploadsDir)

	e.GET("/api/contracts", app.getContracts)
	e.POST("/api/contracts", app.createContract)
	e.GET("/api/contracts/:id", app.getContractById)
	e.PUT("/api/contracts/:id", app.updateContract)
	e.DELETE("/api/contracts/:id", app.deleteContract)
	e.PUT("/api/documents/:id", app.updateDocument)
	e.DELETE("/api/documents/:id", app.deleteDocument)
	e.GET("/api/contract_holders", app.getContractHolders)
	e.GET("/api/search_logos", app.searchLogos)

	return e
}
