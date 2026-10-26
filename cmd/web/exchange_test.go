package main

import (
	"context"
	"errors"
	"testing"
)

func TestParseExchange(t *testing.T) {
	app := &application{}
	ctx := context.Background()

	file, err := app.parseExchange(ctx, []byte(`{"format":"jucosuma","format_version":2,"app_version":"0.13.0",
		"persons":[{"id":7,"name":"Julia","in_household":true}],
		"entries":[{"name":"Spotify","kind":"expense","billing_period":"monthly","start_date":"2026-01-01",
			"shares":[{"person_id":7,"weight":0,"amount":10}]}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if file.AppVersion != "0.13.0" || len(file.Persons) != 1 || len(file.Entries) != 1 || *file.Entries[0].Shares[0].Amount != 10 {
		t.Errorf("unexpected file %+v", file)
	}

	if _, err := app.parseExchange(ctx, []byte(`{"format":"jucosuma","format_version":99}`)); !errors.Is(err, errExchangeTooNew) {
		t.Errorf("newer format: err = %v", err)
	}
	if _, err := app.parseExchange(ctx, []byte(`{"foo":1}`)); err == nil {
		t.Error("foreign JSON accepted")
	}
	if _, err := app.parseExchange(ctx, []byte(`not json`)); err == nil {
		t.Error("invalid JSON accepted")
	}
}
