package main

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	"github.com/Serbroda/contracts/internal/db"
	"github.com/Serbroda/contracts/internal/db/migrations"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

const ingStatement = `Umsatzanzeige;Datei erstellt am: 03.11.2026 10:51

IBAN;DE89 3704 0044 0532 0130 00
Kontoname;Girokonto
Bank;ING
Zeitraum;03.10.2026 - 03.11.2026
Saldo;1.438,10;EUR

Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Referenz;Saldo;Währung;Betrag;Währung
02.11.2026;02.11.2026;VISA SUPERMARKT;Lastschrift;KAUFUMSATZ 29.10 18.06;;1.438,10;EUR;-18,06;EUR
05.10.2026;04.10.2026;Vermieter GmbH;Lastschrift;Miete 10/2026;MANDAT-1;1.456,16;EUR;-1.002,08;EUR
`

func newTestApp(t *testing.T) *application {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "test.db")
	conn, err := db.OpenDB(&dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	db.Migrate(conn, "sqlite", migrations.MigrationsCommon, migrations.MigrationsCommonDir)
	return &application{db: conn, queries: sqlc.New(conn)}
}

func uploadStatement(t *testing.T, app *application, user sqlc.User, preview bool) (int, dtos.BankImportResultDto) {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, _ := w.CreateFormFile("file", "Umsatzanzeige.csv")
	part.Write([]byte(ingStatement))
	if preview {
		w.WriteField("preview", "true")
	}
	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/bank_imports", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user", user)
	if err := app.importBankStatement(c); err != nil {
		if he, ok := err.(*echo.HTTPError); ok {
			return he.Code, dtos.BankImportResultDto{}
		}
		t.Fatal(err)
	}
	var result dtos.BankImportResultDto
	json.Unmarshal(rec.Body.Bytes(), &result)
	return rec.Code, result
}

func TestImportBankStatement(t *testing.T) {
	app := newTestApp(t)
	ctx := context.Background()
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")
	account, err := app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Gemeinschaftskonto", Type: "CHECKING", Iban: ptr("DE89370400440532013000")})
	if err != nil {
		t.Fatal(err)
	}

	code, preview := uploadStatement(t, app, danny, true)
	if code != http.StatusOK || preview.ImportID != nil || preview.Imported != 2 || *preview.AccountID != account.ID || preview.Scope != "HOUSEHOLD" {
		t.Fatalf("preview: %d %+v", code, preview)
	}

	code, first := uploadStatement(t, app, danny, false)
	if code != http.StatusCreated || first.Imported != 2 || first.Duplicates != 0 {
		t.Fatalf("first import: %d %+v", code, first)
	}

	// the same export uploaded by another member of the household is not stored twice
	_, second := uploadStatement(t, app, julia, false)
	if second.Imported != 0 || second.Duplicates != 2 {
		t.Errorf("second import: %+v", second)
	}

	own, _ := app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{OwnerID: danny.ID, DateFrom: mustDate("2026-10-01"), DateTo: mustDate("2026-11-01")})
	if len(own) != 1 || own[0].Amount != -1002.08 || *own[0].Reference != "MANDAT-1" {
		t.Errorf("bookings of October: %+v", own)
	}
	others, _ := app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{OwnerID: julia.ID, DateFrom: mustDate("2026-01-01"), DateTo: mustDate("2027-01-01")})
	if len(others) != 0 {
		t.Errorf("bookings must stay with the uploader, julia sees %d", len(others))
	}
}

func TestImportBankStatementForeignAccount(t *testing.T) {
	app := newTestApp(t)
	ctx := context.Background()
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")
	person, err := app.queries.InsertPerson(ctx, sqlc.InsertPersonParams{Name: "Julia", InHousehold: 1, UserID: &julia.ID})
	if err != nil {
		t.Fatal(err)
	}
	app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Julias Giro", Type: "CHECKING", PersonID: &person.ID, Iban: ptr("DE89370400440532013000")})

	if code, _ := uploadStatement(t, app, danny, false); code != http.StatusForbidden {
		t.Errorf("importing another person's account: %d", code)
	}
	if code, result := uploadStatement(t, app, julia, false); code != http.StatusCreated || result.Scope != "PRIVATE" {
		t.Errorf("own private account: %d %+v", code, result)
	}
}

func insertTestUser(t *testing.T, app *application, name string) sqlc.User {
	t.Helper()
	user, err := app.queries.InsertUser(context.Background(), sqlc.InsertUserParams{Username: name, Password: "x", Role: "user"})
	if err != nil {
		t.Fatal(err)
	}
	return user
}

func mustDate(s string) time.Time {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return t
}
