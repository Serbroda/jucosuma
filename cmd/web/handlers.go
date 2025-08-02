package main

import (
	"encoding/json"
	"fmt"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"html/template"
	"net/http"
	"strconv"
	"time"
)

type LogoResult struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type ContractPageData struct {
	Contract    sqlc.Contract
	IconResults []LogoResult
	FormAction  string // URL, auf die das Formular posted
	FormMethod  string
	SubmitLabel string // Beschriftung des Submit-Buttons
}

func (app *application) home(w http.ResponseWriter, r *http.Request) {
	contracts, err := app.queries.FindAllContracts(r.Context())
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	err = render(w, []string{
		"./ui/html/base.tmpl.html",
		"./ui/html/pages/home.tmpl.html",
	}, struct {
		Contracts []sqlc.Contract
	}{
		Contracts: contracts,
	})

	if err != nil {
		app.serverError(w, r, err)
	}
}

func (app *application) newContract(w http.ResponseWriter, r *http.Request) {
	data := ContractPageData{
		Contract:    sqlc.Contract{}, // leeres Objekt → ID == 0
		IconResults: []LogoResult{},
		FormAction:  "/api/contracts",
		FormMethod:  "post",
		SubmitLabel: "Create",
	}
	err := render(w, []string{
		"./ui/html/base.tmpl.html",
		"./ui/html/partials/icon-results.tmpl.html",
		"./ui/html/pages/contract.tmpl.html",
	}, data)
	if err != nil {
		app.serverError(w, r, err)
	}
}

func (app *application) editContract(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	c, err := app.queries.FindContractById(r.Context(), int64(id))
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	data := ContractPageData{
		Contract:    c,
		IconResults: []LogoResult{},
		FormAction:  fmt.Sprintf("/api/contracts/%d", c.ID),
		FormMethod:  "put",
		SubmitLabel: "Save",
	}
	err = render(w, []string{
		"./ui/html/base.tmpl.html",
		"./ui/html/partials/icon-results.tmpl.html",
		"./ui/html/pages/contract.tmpl.html",
	}, data)
	if err != nil {
		app.serverError(w, r, err)
	}
}

func (app *application) createContractPost(w http.ResponseWriter, r *http.Request) {
	// 1. Formular parsen
	if err := r.ParseForm(); err != nil {
		app.clientError(w, http.StatusBadRequest)
		return
	}
	// 2. Werte auslesen
	name := r.FormValue("name")
	company := r.FormValue("company")
	category := r.FormValue("category")
	logo := r.FormValue("icon_source")
	costsStr := r.FormValue("costs")

	costs, err := strconv.ParseFloat(costsStr, 64)
	if err != nil {
		app.clientError(w, http.StatusBadRequest)
		return
	}

	// 4. Neuer Datensatz via sqlc
	params := sqlc.InsertContractParams{
		Name:       name,
		Company:    &company,
		Category:   category,
		IconSource: &logo,
		Costs:      &costs,
	}
	newID, err := app.queries.InsertContract(r.Context(), params)
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	redirectURL := fmt.Sprintf("/contracts/%d", newID.ID)
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", redirectURL)
		w.WriteHeader(http.StatusOK)
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusSeeOther)
}

func (app *application) updateContractPost(w http.ResponseWriter, r *http.Request) {
	// 1. ID aus Pfad
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id < 1 {
		app.clientError(w, http.StatusBadRequest)
		return
	}
	// 2. Formular parsen
	if err := r.ParseForm(); err != nil {
		app.clientError(w, http.StatusBadRequest)
		return
	}
	// 3. Werte auslesen
	name := r.FormValue("name")
	company := r.FormValue("company")
	category := r.FormValue("category")
	logo := r.FormValue("icon_source")
	costsStr := r.FormValue("costs")

	// 4. Costs konvertieren
	costs, err := strconv.ParseFloat(costsStr, 64)
	if err != nil {
		app.clientError(w, http.StatusBadRequest)
		return
	}

	// 5. Update via sqlc
	params := sqlc.UpdateContractByIdParams{
		ID:         int64(id),
		Name:       name,
		Company:    &company,
		Category:   category,
		IconSource: &logo,
		Costs:      &costs,
	}
	if err := app.queries.UpdateContractById(r.Context(), params); err != nil {
		app.serverError(w, r, err)
		return
	}

	redirectURL := fmt.Sprintf("/contracts/%d", id)
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", redirectURL)
		w.WriteHeader(http.StatusOK)
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusSeeOther)
}

func (app *application) contract(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id < 1 {
		http.NotFound(w, r)
		return
	}

	contract, err := app.queries.FindContractById(r.Context(), int64(id))
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	err = render(w, []string{
		"./ui/html/base.tmpl.html",
		"./ui/html/partials/icon-results.tmpl.html",
		"./ui/html/pages/contract.tmpl.html",
	}, struct {
		Contract    sqlc.Contract
		IconResults []LogoResult
	}{
		Contract:    contract,
		IconResults: make([]LogoResult, 0),
	})

	if err != nil {
		app.serverError(w, r, err)
	}
}

// Der neue Handler
func (app *application) htmxIcons(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")

	results, err := searchLogos(term) // liefert []LogoResult
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	// Nur das Partial „icon-results“ rendern
	tmpl, err := template.ParseFiles(
		"./ui/html/partials/icon-results.tmpl.html",
	)
	if err != nil {
		app.serverError(w, r, err)
		return
	}
	// Das Partial heißt in der Datei {{define "icon-results"}}…
	if err := tmpl.ExecuteTemplate(w, "icon-results", struct {
		IconResults []LogoResult
	}{IconResults: results}); err != nil {
		app.serverError(w, r, err)
	}
}

func (app *application) apiLogos(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")
	if term == "" {
		http.Error(w, `{"error":"missing ?term= parameter"}`, http.StatusBadRequest)
		return
	}

	results, err := searchLogos(term)
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	// Setze Header und sende JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(results); err != nil {
		app.serverError(w, r, err)
	}
}

func render(w http.ResponseWriter, files []string, data any) error {
	funcMap := template.FuncMap{
		"now": func() int64 {
			return time.Now().Unix()
		},
	}
	ts, err := template.New("default").Funcs(funcMap).ParseFiles(files...)
	if err != nil {
		return err
	}

	err = ts.ExecuteTemplate(w, "base", data)
	if err != nil {
		return err
	}
	return nil
}

func searchLogos(term string) ([]LogoResult, error) {
	if term == "" {
		return make([]LogoResult, 0), nil
	}

	results, err := utils.SearchAppLogos(term)
	if err != nil {
		return nil, err
	}

	var logos []LogoResult
	for _, res := range results {
		logos = append(logos, LogoResult{
			Name: res.TrackName,
			Logo: res.ArtworkUrl100,
		})
	}
	return logos, nil
}
