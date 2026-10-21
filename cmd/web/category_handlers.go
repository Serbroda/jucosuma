package main

import (
	"net/http"
	"strconv"
	"strings"

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
		Type:      categoryType(payload.Type),
		Color:     payload.Color,
		Icon:      utils.TrimToNil(payload.Icon),
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

	ctx := c.Request().Context()
	existing, err := app.queries.FindCategoryById(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "category not found")
	}

	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	err = qtx.UpdateCategoryById(ctx, sqlc.UpdateCategoryByIdParams{
		ID:        id,
		Name:      payload.Name,
		SortOrder: payload.SortOrder,
		Type:      categoryType(payload.Type),
		Color:     payload.Color,
		Icon:      utils.TrimToNil(payload.Icon),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update category: "+err.Error())
	}
	// entries reference the category by id; only their readable name copy follows the rename
	if existing.Name != payload.Name {
		if err := qtx.SyncContractCategoryName(ctx, sqlc.SyncContractCategoryNameParams{
			Name:       payload.Name,
			CategoryID: &id,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to update entries: "+err.Error())
		}
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (app *application) deleteCategory(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	existing, err := qtx.FindCategoryById(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "category not found")
	}
	categories, err := app.loadCategories(ctx, qtx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	// entries of the deleted category move to the "other" category of the same type
	if fallback := categories.fallback(existing.Type); fallback != nil && fallback.ID != id {
		if err := qtx.ReassignContractCategory(ctx, sqlc.ReassignContractCategoryParams{
			NewID:   &fallback.ID,
			NewName: fallback.Name,
			OldID:   &id,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to reassign entries: "+err.Error())
		}
	}

	if err := qtx.DeleteCategorySoft(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete category: "+err.Error())
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

// categoryType converts the API category type to its database value (default: expense).
func categoryType(t string) string {
	if t == string(dtos.EntryKindIncome) {
		return strings.ToUpper(t)
	}
	return strings.ToUpper(string(dtos.EntryKindExpense))
}
