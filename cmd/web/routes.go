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
	auth.PUT("/auth/preferences", app.updatePreferences)

	// Categories (shared by the household, all users can manage them)
	auth.GET("/categories", app.getCategories)
	auth.POST("/categories", app.createCategory)
	auth.PUT("/categories/:id", app.updateCategory)
	auth.DELETE("/categories/:id", app.deleteCategory)

	// Monthly closings (plan vs. actual)
	auth.GET("/month_closings", app.getMonthClosings)
	auth.PUT("/month_closings/:month", app.saveMonthClosing)
	auth.DELETE("/month_closings/:month", app.deleteMonthClosing)

	// Savings goals
	auth.GET("/savings_goals", app.getSavingsGoals)
	auth.POST("/savings_goals", app.createSavingsGoal)
	auth.PUT("/savings_goals/:id", app.updateSavingsGoal)
	auth.DELETE("/savings_goals/:id", app.deleteSavingsGoal)

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
	auth.POST("/contracts/:id/amounts", app.saveContractAmount)
	auth.PUT("/contracts/:id/amounts/:amountId", app.updateContractAmount)
	auth.DELETE("/contracts/:id/amounts/:amountId", app.deleteContractAmount)
	auth.PUT("/documents/:id", app.updateDocument)
	auth.DELETE("/documents/:id", app.deleteDocument)
	auth.GET("/contract_holders", app.getContractHolders)
	auth.GET("/companies", app.getCompanies)
	auth.GET("/contacts", app.getContacts)
	auth.POST("/contacts", app.createContact)
	auth.PUT("/contacts/:id", app.updateContact)
	auth.DELETE("/contacts/:id", app.deleteContact)
	auth.GET("/used_icons", app.getUsedIcons)
	auth.GET("/search_logos", app.searchLogos)
	auth.POST("/icon_from_url", app.iconFromURL)

	// Household: persons and accounts (all users can manage)
	auth.GET("/user_options", app.getUserOptions)
	auth.GET("/persons", app.getPersons)
	auth.POST("/persons", app.createPerson)
	auth.PUT("/persons/:id", app.updatePerson)
	auth.DELETE("/persons/:id", app.deletePerson)
	auth.GET("/accounts", app.getAccounts)
	auth.POST("/accounts", app.createAccount)
	auth.PUT("/accounts/:id", app.updateAccount)
	auth.DELETE("/accounts/:id", app.deleteAccount)

	// Admin-only routes
	admin := auth.Group("", app.requireAdmin)
	admin.GET("/users", app.getUsers)
	admin.POST("/users", app.createUser)
	admin.PUT("/users/:id", app.updateUser)
	admin.DELETE("/users/:id", app.deleteUser)
	admin.PUT("/users/:id/reset-password", app.resetUserPassword)
	admin.GET("/backups", app.getBackupSettings)
	admin.PUT("/backups", app.saveBackupSettings)
	admin.POST("/backups/run", app.runBackup)

	return e
}
