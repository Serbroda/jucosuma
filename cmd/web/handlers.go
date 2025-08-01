package main

import (
	"encoding/json"
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
