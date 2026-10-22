package main

import (
	"strings"
	"testing"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
)

func date(s string) dtos.DateOnly {
	t, _ := time.Parse("2006-01-02", s)
	return dtos.DateOnly(t)
}

func ptrTo[T any](v T) *T { return &v }

func keys(rs []reminder) []string {
	var out []string
	for _, r := range rs {
		out = append(out, r.Key)
	}
	return out
}

func TestDeadlineStages(t *testing.T) {
	de := newTexts("de")
	c := dtos.ContractDto{ID: 1, Name: "Handy", IsContract: true, Kind: dtos.EntryKindExpense, BillingPeriod: "monthly",
		CancelBy: ptrTo(date("2026-11-15")), TermEnd: ptrTo(date("2026-12-15")), Status: dtos.ContractStatusActive}
	now := func(s string) time.Time { d, _ := time.Parse("2006-01-02", s); return d.Add(9 * time.Hour) }

	if got := keys(entryReminders(c, now("2026-10-15"), de, nil)); len(got) != 0 {
		t.Errorf("31 days before: %v", got)
	}
	r := entryReminders(c, now("2026-10-16"), de, nil)
	if len(r) != 1 || r[0].Key != "deadline:1:2026-11-15:30" || !strings.Contains(r[0].Body, "15.11.2026 (in 30 Tagen)") ||
		!strings.Contains(r[0].Body, "15.12.2026") || r[0].Link != "/contracts/1" {
		t.Errorf("30 days before: %+v", r)
	}
	if got := keys(entryReminders(c, now("2026-11-08"), de, nil)); len(got) != 1 || got[0] != "deadline:1:2026-11-15:7" {
		t.Errorf("7 days before: %v", got)
	}
	if r := entryReminders(c, now("2026-11-15"), de, nil); !strings.Contains(r[0].Body, "(heute)") {
		t.Errorf("on the day: %+v", r)
	}
	if got := keys(entryReminders(c, now("2026-11-16"), de, nil)); len(got) != 0 {
		t.Errorf("after the deadline: %v", got)
	}
}

func TestIrregularPayments(t *testing.T) {
	en := newTexts("en")
	now, _ := time.Parse("2006-01-02", "2026-10-22")
	yearly := dtos.ContractDto{ID: 2, Name: "Car insurance", Kind: dtos.EntryKindExpense, BillingPeriod: "annually",
		NextBillingDate: ptrTo(date("2026-10-27")), Costs: ptrTo(540.0), BaseCosts: ptrTo(500.0),
		Amounts: []dtos.ContractAmountDto{{ID: 9, ValidFrom: date("2026-01-01"), Costs: 540}}, AccountID: ptrTo(int64(10)),
		Status: dtos.ContractStatusActive}
	r := entryReminders(yearly, now, en, map[int64]string{10: "Joint"})
	if len(r) != 1 || r[0].Key != "payment:2:2026-10-27" || r[0].Body != "in 5 days (2026-10-27): €540.00. Account: Joint." {
		t.Errorf("yearly payment: %+v", r)
	}
	monthly := yearly
	monthly.BillingPeriod = "monthly"
	if got := keys(entryReminders(monthly, now, en, nil)); len(got) != 0 {
		t.Errorf("monthly payments are no reminder: %v", got)
	}
}

func TestAmountChange(t *testing.T) {
	de := newTexts("de")
	now, _ := time.Parse("2006-01-02", "2026-12-28")
	c := dtos.ContractDto{ID: 3, Name: "Haftpflicht", Kind: dtos.EntryKindExpense, BillingPeriod: "monthly", BaseCosts: ptrTo(70.0),
		Amounts: []dtos.ContractAmountDto{{ID: 5, ValidFrom: date("2027-01-01"), Costs: 85}}, Status: dtos.ContractStatusActive}
	r := entryReminders(c, now, de, nil)
	if len(r) != 1 || r[0].Key != "amount:5" || r[0].Body != "Ab 01.01.2027: 85,00 € statt 70,00 €." {
		t.Errorf("amount change: %+v", r)
	}
}

func TestClosingReminders(t *testing.T) {
	de := newTexts("de")
	at := func(s string) time.Time { d, _ := time.Parse("2006-01-02", s); return d }
	if r := closingReminders(at("2026-11-01"), map[string]bool{}, de); len(r) != 0 {
		t.Errorf("on the 1st: %+v", r)
	}
	r := closingReminders(at("2026-11-02"), map[string]bool{}, de)
	if len(r) != 1 || r[0].Key != "closing:2026-10:1" || r[0].Title != "Monatsabschluss Oktober 2026" || r[0].Link != "/closing?month=2026-10" {
		t.Errorf("on the 2nd: %+v", r)
	}
	if got := keys(closingReminders(at("2026-11-09"), map[string]bool{}, de)); got[0] != "closing:2026-10:2" {
		t.Errorf("from the 7th: %v", got)
	}
	if r := closingReminders(at("2026-11-09"), map[string]bool{"2026-10": true}, de); len(r) != 0 {
		t.Errorf("closed month: %+v", r)
	}
}

func TestMoney(t *testing.T) {
	eur := "EUR"
	if got := newTexts("de").money(1234.5, &eur); got != "1.234,50 €" {
		t.Errorf("de: %s", got)
	}
	if got := newTexts("en").money(1234.5, nil); got != "€1,234.50" {
		t.Errorf("en: %s", got)
	}
}
