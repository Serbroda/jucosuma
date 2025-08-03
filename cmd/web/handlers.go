package main

import (
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
	"net/http"
	"strconv"
)

type LogoDto struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

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

func (app *application) searchLogos(ctx echo.Context) error {
	term := ctx.QueryParam("term")
	if term == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "term is required")
	}

	results, err := utils.SearchAppLogos(term)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var logos []LogoDto
	for _, res := range results {
		logos = append(logos, LogoDto{
			Name: res.TrackName,
			Logo: res.ArtworkUrl100,
		})
	}
	return ctx.JSON(http.StatusOK, logos)
}
