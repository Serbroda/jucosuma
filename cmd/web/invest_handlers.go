package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

// Invest plans are private to the user who created them (also for admins) and are plans only:
// they create no entries and are not part of the household export.

func mapInvestPlan(plan sqlc.InvestPlan, items []sqlc.InvestPlanItem) dtos.InvestPlanDto {
	dto := dtos.InvestPlanDto{ID: plan.ID, Name: plan.Name, Amount: plan.Amount, Items: []dtos.InvestPlanItemDto{}, UpdatedAt: plan.UpdatedAt}
	for _, item := range items {
		dto.Items = append(dto.Items, dtos.InvestPlanItemDto{
			ID: item.ID, Name: item.Name, Mode: dtos.InvestMode(strings.ToLower(item.Mode)), Value: item.Value, AccountID: item.AccountID,
		})
	}
	return dto
}

// investPlans loads the user's plans with their positions.
func (app *application) investPlans(ctx context.Context, userID int64) ([]dtos.InvestPlanDto, error) {
	plans, err := app.queries.FindInvestPlansByOwner(ctx, userID)
	if err != nil {
		return nil, err
	}
	items, err := app.queries.FindInvestPlanItemsByOwner(ctx, userID)
	if err != nil {
		return nil, err
	}
	itemsByPlan := make(map[int64][]sqlc.InvestPlanItem)
	for _, item := range items {
		itemsByPlan[item.PlanID] = append(itemsByPlan[item.PlanID], item)
	}
	result := make([]dtos.InvestPlanDto, 0, len(plans))
	for _, plan := range plans {
		result = append(result, mapInvestPlan(plan, itemsByPlan[plan.ID]))
	}
	return result, nil
}

func (app *application) getInvestPlans(c echo.Context) error {
	user := c.Get("user").(sqlc.User)
	plans, err := app.investPlans(c.Request().Context(), user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, plans)
}

// investPlanParams validates a plan payload: trimmed names and only accounts the user may use.
func (app *application) investPlanParams(c echo.Context, user sqlc.User) (dtos.SaveInvestPlanDto, error) {
	var payload dtos.SaveInvestPlanDto
	if err := BindAndValidate(c, &payload); err != nil {
		return payload, err
	}
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Name == "" {
		return payload, echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	ctx := c.Request().Context()
	for i := range payload.Items {
		item := &payload.Items[i]
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			return payload, echo.NewHTTPError(http.StatusBadRequest, "position name is required")
		}
		if item.AccountID != nil {
			account, err := app.findAccount(ctx, *item.AccountID)
			if err != nil {
				return payload, err
			}
			if err := app.ensureOwnOrSharedAccount(ctx, account, user.ID); err != nil {
				return payload, err
			}
		}
	}
	return payload, nil
}

// replaceInvestPlanItems stores the positions of a plan in the given order.
func replaceInvestPlanItems(ctx context.Context, q *sqlc.Queries, planID int64, items []dtos.SaveInvestPlanItemDto) error {
	if err := q.DeleteInvestPlanItems(ctx, planID); err != nil {
		return err
	}
	for i, item := range items {
		if err := q.InsertInvestPlanItem(ctx, sqlc.InsertInvestPlanItemParams{
			PlanID: planID, Name: item.Name, Mode: strings.ToUpper(item.Mode), Value: item.Value,
			AccountID: item.AccountID, SortOrder: int64(i),
		}); err != nil {
			return err
		}
	}
	return nil
}

// saveInvestPlan creates (id 0) or updates a plan of the user together with its positions.
func (app *application) saveInvestPlan(c echo.Context, id int64) error {
	user := c.Get("user").(sqlc.User)
	payload, err := app.investPlanParams(c, user)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	status := http.StatusOK
	if id == 0 {
		plan, err := qtx.InsertInvestPlan(ctx, sqlc.InsertInvestPlanParams{OwnerID: user.ID, Name: payload.Name, Amount: payload.Amount})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to create plan: "+err.Error())
		}
		id = plan.ID
		status = http.StatusCreated
	} else {
		rows, err := qtx.UpdateInvestPlan(ctx, sqlc.UpdateInvestPlanParams{ID: id, OwnerID: user.ID, Name: payload.Name, Amount: payload.Amount})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to update plan: "+err.Error())
		}
		if rows == 0 {
			return echo.NewHTTPError(http.StatusNotFound, "plan not found")
		}
	}
	if err := replaceInvestPlanItems(ctx, qtx, id, payload.Items); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save positions: "+err.Error())
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	plans, err := app.investPlans(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	for _, plan := range plans {
		if plan.ID == id {
			return c.JSON(status, plan)
		}
	}
	return echo.NewHTTPError(http.StatusInternalServerError, "plan not found after saving")
}

func (app *application) createInvestPlan(c echo.Context) error {
	return app.saveInvestPlan(c, 0)
}

func (app *application) updateInvestPlan(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return app.saveInvestPlan(c, id)
}

func (app *application) deleteInvestPlan(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	user := c.Get("user").(sqlc.User)

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	rows, err := qtx.DeleteInvestPlan(ctx, sqlc.DeleteInvestPlanParams{ID: id, OwnerID: user.ID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "plan not found")
	}
	// foreign keys are not enforced on every connection, so the positions go explicitly
	if err := qtx.DeleteInvestPlanItems(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
