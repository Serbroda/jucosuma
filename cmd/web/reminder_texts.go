package main

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

// texts are the server-side texts of reminders in the user's language.
type texts struct {
	lang       string
	dateFormat string
}

var reminderTexts = map[string]map[string]string{
	"de": {
		"deadlineTitle":   "Kündigungsfrist: %s",
		"deadlineBody":    "Kündbar bis %s (%s).",
		"deadlineRenewal": "Sonst verlängert sich der Vertrag nach dem %s.",
		"endTitle":        "Vertrag endet: %s",
		"endBody":         "Läuft am %s aus (%s).",
		"paymentTitle":    "Abbuchung: %s",
		"paymentBody":     "%s (%s): %s.",
		"paymentFrom":     "Konto: %s.",
		"amountTitle":     "Neuer Betrag: %s",
		"amountBody":      "Ab %s: %s",
		"amountInstead":   "statt %s.",
		"closingTitle":    "Monatsabschluss %s",
		"closingBody":     "%s ist noch nicht abgeschlossen.",
		"backupTitle":     "Datensicherung fehlgeschlagen",
		"backupBody":      "Die tägliche Sicherung der Datenbank ist fehlgeschlagen: %s",
		"testTitle":       "Test von Jucosuma",
		"testBody":        "Dieser Kanal funktioniert.",
		"today":           "heute",
		"tomorrow":        "morgen",
		"inDays":          "in %d Tagen",
	},
	"en": {
		"deadlineTitle":   "Cancellation deadline: %s",
		"deadlineBody":    "Can be cancelled until %s (%s).",
		"deadlineRenewal": "Otherwise the contract renews after %s.",
		"endTitle":        "Contract ends: %s",
		"endBody":         "Runs out on %s (%s).",
		"paymentTitle":    "Payment: %s",
		"paymentBody":     "%s (%s): %s.",
		"paymentFrom":     "Account: %s.",
		"amountTitle":     "New amount: %s",
		"amountBody":      "From %s: %s",
		"amountInstead":   "instead of %s.",
		"closingTitle":    "Monthly closing %s",
		"closingBody":     "%s is not closed yet.",
		"backupTitle":     "Backup failed",
		"backupBody":      "The daily database backup failed: %s",
		"testTitle":       "Test from Jucosuma",
		"testBody":        "This channel works.",
		"today":           "today",
		"tomorrow":        "tomorrow",
		"inDays":          "in %d days",
	},
}

var monthNames = map[string][]string{
	"de": {"Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"},
	"en": {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"},
}

// texts returns the texts in the user's language: chosen in the settings, otherwise the
// language of the browser seen last, otherwise English.
func (app *application) texts(ctx context.Context, user sqlc.User) texts {
	lang := ""
	if user.Language != nil {
		lang = *user.Language
	} else if p, err := app.queries.FindNotificationProfile(ctx, user.ID); err == nil && p.Language != nil {
		lang = *p.Language
	}
	return newTexts(lang)
}

func newTexts(lang string) texts {
	if lang == "de" {
		return texts{lang: "de", dateFormat: "02.01.2006"}
	}
	return texts{lang: "en", dateFormat: "2006-01-02"}
}

func (t texts) f(key string, args ...any) string {
	return fmt.Sprintf(reminderTexts[t.lang][key], args...)
}

func (t texts) inDays(days int) string {
	switch days {
	case 0:
		return reminderTexts[t.lang]["today"]
	case 1:
		return reminderTexts[t.lang]["tomorrow"]
	}
	return t.f("inDays", days)
}

func (t texts) monthName(month time.Time) string {
	return fmt.Sprintf("%s %d", monthNames[t.lang][month.Month()-1], month.Year())
}

var currencySymbols = map[string]string{"EUR": "€", "USD": "$", "GBP": "£"}

// money formats an amount like the app does (German: 1.234,56 €).
func (t texts) money(amount float64, currency *string) string {
	code := "EUR"
	if currency != nil && *currency != "" {
		code = *currency
	}
	symbol := code
	if s, ok := currencySymbols[code]; ok {
		symbol = s
	}
	cents := int64(math.Round(math.Abs(amount) * 100))
	whole, frac := cents/100, cents%100
	digits := fmt.Sprintf("%d", whole)
	sep, dec := ",", "."
	if t.lang == "de" {
		sep, dec = ".", ","
	}
	var b strings.Builder
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteString(sep)
		}
		b.WriteRune(r)
	}
	sign := ""
	if amount < 0 {
		sign = "-"
	}
	if t.lang == "de" {
		return fmt.Sprintf("%s%s%s%02d %s", sign, b.String(), dec, frac, symbol)
	}
	return fmt.Sprintf("%s%s%s%s%02d", sign, symbol, b.String(), dec, frac)
}
