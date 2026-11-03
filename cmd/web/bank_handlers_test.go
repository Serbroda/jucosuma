package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	"github.com/Serbroda/contracts/internal/db"
	"github.com/Serbroda/contracts/internal/db/migrations"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/go-playground/validator/v10"
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

func TestUpdateBankTransactionsOnlyOwn(t *testing.T) {
	app := newTestApp(t)
	ctx := context.Background()
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")
	app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Gemeinschaftskonto", Type: "CHECKING", Iban: ptr("DE89370400440532013000")})
	uploadStatement(t, app, danny, false)
	categories, _ := app.queries.FindAllCategories(ctx)

	update := func(user sqlc.User, body string) int {
		req := httptest.NewRequest(http.MethodPut, "/api/bank_transactions", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		e := echo.New()
		e.Validator = &CustomValidator{validator: validator.New()}
		c := e.NewContext(req, rec)
		c.Set("user", user)
		if err := app.updateBankTransactions(c); err != nil {
			return err.(*echo.HTTPError).Code
		}
		return rec.Code
	}
	body := fmt.Sprintf(`{"ids":[1,2],"scope":"PRIVATE","category_id":%d}`, categories[0].ID)
	if code := update(julia, body); code != http.StatusNoContent {
		t.Fatalf("update by julia: %d", code)
	}
	all, _ := app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{OwnerID: danny.ID, DateFrom: mustDate("2026-01-01"), DateTo: mustDate("2027-01-01")})
	for _, tx := range all {
		if tx.Scope != "HOUSEHOLD" || tx.CategoryID != nil {
			t.Fatalf("julia changed danny's booking: %+v", tx)
		}
	}

	if code := update(danny, body); code != http.StatusNoContent {
		t.Fatalf("update by danny: %d", code)
	}
	all, _ = app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{OwnerID: danny.ID, DateFrom: mustDate("2026-01-01"), DateTo: mustDate("2027-01-01")})
	for _, tx := range all {
		if tx.Scope != "PRIVATE" || tx.CategoryID == nil || *tx.CategoryID != categories[0].ID || *tx.ClassifiedBy != "MANUAL" {
			t.Errorf("not updated: %+v", tx)
		}
	}
	if code := update(danny, `{"ids":[1],"scope":"SOMEONE"}`); code != http.StatusBadRequest {
		t.Errorf("invalid scope: %d", code)
	}
}

func TestCloseBankImportAndPurge(t *testing.T) {
	app := newTestApp(t)
	ctx := context.Background()
	danny := insertTestUser(t, app, "danny")
	app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Gemeinschaftskonto", Type: "CHECKING", Iban: ptr("DE89370400440532013000")})
	_, imported := uploadStatement(t, app, danny, false)
	id := strconv.FormatInt(*imported.ImportID, 10)

	call := func(handler echo.HandlerFunc) int {
		req := httptest.NewRequest(http.MethodPut, "/", nil)
		c := echo.New().NewContext(req, httptest.NewRecorder())
		c.SetParamNames("id")
		c.SetParamValues(id)
		c.Set("user", danny)
		if err := handler(c); err != nil {
			return err.(*echo.HTTPError).Code
		}
		return http.StatusNoContent
	}
	if code := call(app.closeBankImport); code != http.StatusNoContent {
		t.Fatalf("close: %d", code)
	}
	if code := call(app.closeBankImport); code != http.StatusConflict {
		t.Errorf("closing twice: %d", code)
	}

	// within the retention nothing is removed
	if err := app.purgeBankDetails(ctx); err != nil {
		t.Fatal(err)
	}
	all := func() []sqlc.BankTransaction {
		list, _ := app.queries.FindBankTransactionsByOwner(ctx, sqlc.FindBankTransactionsByOwnerParams{OwnerID: danny.ID, DateFrom: mustDate("2026-01-01"), DateTo: mustDate("2027-01-01")})
		return list
	}
	if all()[0].Counterparty == "" {
		t.Fatal("details removed before the retention ended")
	}

	// four months later the details are gone, amounts and duplicate detection stay
	if _, err := app.db.ExecContext(ctx, "UPDATE bank_imports SET closed_at = datetime('now', '-4 months')"); err != nil {
		t.Fatal(err)
	}
	if err := app.purgeBankDetails(ctx); err != nil {
		t.Fatal(err)
	}
	for _, tx := range all() {
		if tx.Counterparty != "" || tx.Purpose != "" || tx.Reference != nil || tx.Amount == 0 {
			t.Errorf("not purged: %+v", tx)
		}
	}
	if _, again := uploadStatement(t, app, danny, true); again.Duplicates != 2 {
		t.Errorf("purged bookings must still be recognised: %+v", again)
	}
	if code := call(app.reopenBankImport); code != http.StatusConflict {
		t.Errorf("reopening a purged import: %d", code)
	}
}

func TestLinkBankTransactionsToEntry(t *testing.T) {
	app := newTestApp(t)
	ctx := context.Background()
	danny := insertTestUser(t, app, "danny")
	julia := insertTestUser(t, app, "julia")
	app.queries.InsertAccount(ctx, sqlc.InsertAccountParams{Name: "Gemeinschaftskonto", Type: "CHECKING", Iban: ptr("DE89370400440532013000")})
	uploadStatement(t, app, danny, false)
	categories, _ := app.queries.FindAllCategories(ctx)
	groceries := categories[0].ID

	insertEntry := func(name string, owner *int64) int64 {
		res, err := app.db.ExecContext(ctx, `INSERT INTO contracts (name, kind, category_id, is_variable, owner_id, start_date, billing_period, costs)
			VALUES (?, 'EXPENSE', ?, 1, ?, '2026-01-01', 'MONTHLY', 600)`, name, groceries, owner)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		return id
	}
	shared := insertEntry("Lebensmittel", nil)
	juliasPrivate := insertEntry("Julias Budget", &julia.ID)

	update := func(body string) int {
		req := httptest.NewRequest(http.MethodPut, "/api/bank_transactions", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		e := echo.New()
		e.Validator = &CustomValidator{validator: validator.New()}
		c := e.NewContext(req, httptest.NewRecorder())
		c.Set("user", danny)
		if err := app.updateBankTransactions(c); err != nil {
			return err.(*echo.HTTPError).Code
		}
		return http.StatusNoContent
	}
	if code := update(fmt.Sprintf(`{"ids":[1],"contract_id":%d}`, juliasPrivate)); code != http.StatusBadRequest {
		t.Errorf("linking another user's private entry: %d", code)
	}
	if code := update(fmt.Sprintf(`{"ids":[1],"contract_id":%d}`, shared)); code != http.StatusNoContent {
		t.Fatalf("link: %d", code)
	}
	first := func() sqlc.BankTransaction {
		list, _ := app.queries.FindBankTransactionsByImport(ctx, sqlc.FindBankTransactionsByImportParams{OwnerID: danny.ID, ImportID: 1})
		for _, tx := range list {
			if tx.ID == 1 {
				return tx
			}
		}
		t.Fatal("booking 1 not found")
		return sqlc.BankTransaction{}
	}
	linked := first()
	if linked.ContractID == nil || *linked.ContractID != shared || *linked.CategoryID != groceries {
		t.Fatalf("not linked: %+v", linked)
	}
	// a plain category removes the link again
	update(fmt.Sprintf(`{"ids":[1],"category_id":%d}`, categories[1].ID))
	if first().ContractID != nil {
		t.Errorf("link kept after choosing a category")
	}
}
