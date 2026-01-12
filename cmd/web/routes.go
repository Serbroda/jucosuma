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

	e.GET("/api/agreements", app.getAgreements)
	e.POST("/api/agreements", app.createAgreement)
	e.GET("/api/agreements/:id", app.getAgreementById)
	e.PUT("/api/agreements/:id", app.updateAgreement)
	e.DELETE("/api/agreements/:id", app.deleteAgreement)
	e.PUT("/api/documents/:id", app.updateDocument)
	e.DELETE("/api/documents/:id", app.deleteDocument)
	e.GET("/api/agreement_holders", app.getAgreementHolders)
	e.GET("/api/search_logos", app.searchLogos)

	return e
}
