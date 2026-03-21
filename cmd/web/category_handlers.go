package main

import (
	"net/http"
	"strconv"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

func (app *application) getCategories(c echo.Context) error {
	categories, err := app.queries.FindAllCategories(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(categories, dtos.MapCategoryToCategoryDto))
}

func (app *application) createCategory(c echo.Context) error {
	var payload dtos.CreateCategoryDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	cat, err := app.queries.InsertCategory(c.Request().Context(), sqlc.InsertCategoryParams{
		Name:      payload.Name,
		SortOrder: payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create category: "+err.Error())
	}

	return c.JSON(http.StatusCreated, dtos.MapCategoryToCategoryDto(cat))
}

func (app *application) updateCategory(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var payload dtos.UpdateCategoryDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	err = app.queries.UpdateCategoryById(c.Request().Context(), sqlc.UpdateCategoryByIdParams{
		ID:        id,
		Name:      payload.Name,
		SortOrder: payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update category: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (app *application) deleteCategory(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	err = app.queries.DeleteCategorySoft(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete category: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}
