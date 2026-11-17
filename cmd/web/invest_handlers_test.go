package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

// investRequest calls an invest plan handler as the given user and returns the status and body.
func investRequest(t *testing.T, user sqlc.User, method string, id int64, body string, handler echo.HandlerFunc) (int, []byte) {
	t.Helper()
	e := echo.New()
	e.Validator = &CustomValidator{validator: validator.New()}
	req := httptest.NewRequest(method, "/api/invest_plans", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user", user)
	if id != 0 {
		c.SetParamNames("id")
		c.SetParamValues(strconv.FormatInt(id, 10))
	}
	if err := handler(c); err != nil {
		if he, ok := err.(*echo.HTTPError); ok {
			return he.Code, nil
		}
		t.Fatal(err)
	}
	return rec.Code, rec.Body.Bytes()
}

func TestInvestPlansArePrivate(t *testing.T) {
	app := newTestApp(t)
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")

	code, body := investRequest(t, danny, http.MethodPost, 0,
		`{"name":" Sparplan ","amount":500,"items":[{"name":"Tagesgeld","mode":"fixed","value":100},{"name":"ETF Welt","mode":"percent","value":70},{"name":"ETF EM","mode":"percent","value":30}]}`,
		app.createInvestPlan)
	var plan dtos.InvestPlanDto
	json.Unmarshal(body, &plan)
	if code != http.StatusCreated || plan.Name != "Sparplan" || plan.Amount != 500 || len(plan.Items) != 3 ||
		plan.Items[0].Mode != dtos.InvestModeFixed || plan.Items[1].Name != "ETF Welt" {
		t.Fatalf("create: %d %+v", code, plan)
	}

	list := func(user sqlc.User) []dtos.InvestPlanDto {
		_, body := investRequest(t, user, http.MethodGet, 0, "", app.getInvestPlans)
		var plans []dtos.InvestPlanDto
		json.Unmarshal(body, &plans)
		return plans
	}
	if plans := list(julia); len(plans) != 0 {
		t.Errorf("julia sees %d plans of danny", len(plans))
	}

	update := `{"name":"Sparplan","amount":600,"items":[{"name":"ETF Welt","mode":"percent","value":100}]}`
	if code, _ := investRequest(t, julia, http.MethodPut, plan.ID, update, app.updateInvestPlan); code != http.StatusNotFound {
		t.Errorf("julia updates danny's plan: %d", code)
	}
	if code, _ := investRequest(t, julia, http.MethodDelete, plan.ID, "", app.deleteInvestPlan); code != http.StatusNotFound {
		t.Errorf("julia deletes danny's plan: %d", code)
	}
	if plans := list(danny); len(plans) != 1 || plans[0].Amount != 500 || len(plans[0].Items) != 3 {
		t.Fatalf("plan changed by another user: %+v", plans)
	}

	// saving replaces the positions
	if code, _ := investRequest(t, danny, http.MethodPut, plan.ID, update, app.updateInvestPlan); code != http.StatusOK {
		t.Fatalf("update: %d", code)
	}
	if plans := list(danny); plans[0].Amount != 600 || len(plans[0].Items) != 1 || plans[0].Items[0].Value != 100 {
		t.Errorf("after update: %+v", plans)
	}

	if code, _ := investRequest(t, danny, http.MethodDelete, plan.ID, "", app.deleteInvestPlan); code != http.StatusNoContent {
		t.Fatalf("delete: %d", code)
	}
	if items, _ := app.queries.FindInvestPlanItemsByOwner(t.Context(), danny.ID); len(list(danny)) != 0 || len(items) != 0 {
		t.Errorf("plan or positions left after delete")
	}
}

func TestInvestPlanValidation(t *testing.T) {
	app := newTestApp(t)
	ctx := t.Context()
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")
	person, err := app.queries.InsertPerson(ctx, sqlc.InsertPersonParams{Name: "Julia", InHousehold: 1, UserID: &julia.ID})
	if err != nil {
		t.Fatal(err)
	}
	depot, err := app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Julias Depot", Type: "DEPOT", PersonID: &person.ID})
	if err != nil {
		t.Fatal(err)
	}

	for name, body := range map[string]string{
		"no name":         `{"name":"  ","amount":100,"items":[]}`,
		"negative amount": `{"name":"Plan","amount":-1,"items":[]}`,
		"unknown mode":    `{"name":"Plan","amount":100,"items":[{"name":"ETF","mode":"weight","value":1}]}`,
		"negative value":  `{"name":"Plan","amount":100,"items":[{"name":"ETF","mode":"percent","value":-5}]}`,
	} {
		if code, _ := investRequest(t, danny, http.MethodPost, 0, body, app.createInvestPlan); code != http.StatusBadRequest {
			t.Errorf("%s: %d", name, code)
		}
	}

	foreign := `{"name":"Plan","amount":100,"items":[{"name":"ETF","mode":"percent","value":100,"account_id":` + strconv.FormatInt(depot.ID, 10) + `}]}`
	if code, _ := investRequest(t, danny, http.MethodPost, 0, foreign, app.createInvestPlan); code != http.StatusForbidden {
		t.Errorf("another person's account: %d", code)
	}
	if code, _ := investRequest(t, julia, http.MethodPost, 0, foreign, app.createInvestPlan); code != http.StatusCreated {
		t.Errorf("own account: %d", code)
	}
}
