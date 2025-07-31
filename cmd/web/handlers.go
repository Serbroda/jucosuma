package main

import (
	"encoding/json"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"html/template"
	"net/http"
)

func (app *application) home(w http.ResponseWriter, r *http.Request) {
	files := []string{
		"./ui/html/base.tmpl.html",
		"./ui/html/pages/home.tmpl.html",
	}

	ts, err := template.ParseFiles(files...)
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	contracts, err := app.queries.FindAllContracts(r.Context())
	if err != nil {
		app.serverError(w, r, err)
	}

	err = ts.ExecuteTemplate(w, "base", struct {
		Contracts []sqlc.Contract
	}{
		Contracts: contracts,
	})
	if err != nil {
		app.serverError(w, r, err)
	}
}

func (app *application) apiLogos(w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")
	if term == "" {
		http.Error(w, `{"error":"missing ?term= parameter"}`, http.StatusBadRequest)
		return
	}

	results, err := utils.SearchAppLogos(term)
	if err != nil {
		app.serverError(w, r, err)
		return
	}

	// Extrahiere nur die gewünschten Logo-URLs
	type LogoResult struct {
		Name string `json:"name"`
		Logo string `json:"logo"`
	}

	var logos []LogoResult
	for _, res := range results {
		logos = append(logos, LogoResult{
			Name: res.TrackName,
			Logo: res.ArtworkUrl100,
		})
	}

	// Setze Header und sende JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(logos); err != nil {
		app.serverError(w, r, err)
	}
}
