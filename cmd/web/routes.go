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
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			return true, nil
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.BodyLimit("20M"))

	ui.RegisterUi(e)
	e.Static("/uploads", app.uploadsDir)

	// Public auth routes
	e.POST("/api/auth/login", app.login)

	// Auth-required routes
	auth := e.Group("/api", app.requireAuth)
	auth.POST("/auth/logout", app.logout)
	auth.GET("/auth/me", app.me)
	auth.PUT("/auth/change-password", app.changePassword)

	// Categories (all users can read)
	auth.GET("/categories", app.getCategories)

	// Contract routes
	auth.GET("/contracts", app.getContracts)
	auth.GET("/contracts/export.csv", app.exportContractsCSV)
	auth.GET("/contracts/export.json", app.exportContractsJSON)
	auth.POST("/contracts/import", app.importContractsCSV)
	auth.POST("/contracts/import.json", app.importContractsJSON)
	auth.POST("/contracts", app.createContract)
	auth.GET("/contracts/:id", app.getContractById)
	auth.PUT("/contracts/:id", app.updateContract)
	auth.DELETE("/contracts/:id", app.deleteContract)
	auth.PUT("/documents/:id", app.updateDocument)
	auth.DELETE("/documents/:id", app.deleteDocument)
	auth.GET("/contract_holders", app.getContractHolders)
	auth.GET("/companies", app.getCompanies)
	auth.GET("/used_icons", app.getUsedIcons)
	auth.GET("/search_logos", app.searchLogos)

	// Admin-only routes
	admin := auth.Group("", app.requireAdmin)
	admin.GET("/users", app.getUsers)
	admin.POST("/users", app.createUser)
	admin.PUT("/users/:id", app.updateUser)
	admin.DELETE("/users/:id", app.deleteUser)
	admin.PUT("/users/:id/reset-password", app.resetUserPassword)

	// Category management (admin only)
	admin.POST("/categories", app.createCategory)
	admin.PUT("/categories/:id", app.updateCategory)
	admin.DELETE("/categories/:id", app.deleteCategory)

	return e
}
