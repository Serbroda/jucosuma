package main

import (
	"io"
	"net/http"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

func (app *application) exportContractsJSON(ctx echo.Context) error {
	user := ctx.Get("user").(sqlc.User)
	file, err := app.buildExchange(ctx.Request().Context(), user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	name := "jucosuma-export-" + time.Now().Format("2006-01-02") + ".json"
	ctx.Response().Header().Set("Content-Disposition", "attachment; filename="+name)
	return ctx.JSONPretty(http.StatusOK, file, "  ")
}

// importContractsJSON imports a JSON export (any format version). With ?preview=true the import
// runs in a transaction that is rolled back, so the preview shows exactly what would happen.
func (app *application) importContractsJSON(c echo.Context) error {
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot read body")
	}
	ctx := c.Request().Context()
	file, err := app.parseExchange(ctx, body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	user := c.Get("user").(sqlc.User)
	result, err := app.importExchange(ctx, app.queries.WithTx(tx), user, file)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "import failed: "+err.Error())
	}
	if c.QueryParam("preview") != "true" {
		if err := tx.Commit(); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}
	return c.JSON(http.StatusOK, result)
}

// importBaseCosts returns the amount from the start date: exports with an amount history carry
// today's amount in "costs" and the start amount in "base_costs".
func importBaseCosts(p dtos.CreateContractDto) *float64 {
	if len(p.Amounts) > 0 && p.BaseCosts != nil {
		return p.BaseCosts
	}
	return p.Costs
}
