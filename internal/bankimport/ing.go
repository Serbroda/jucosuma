package bankimport

import (
	"encoding/csv"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// ING exports ("Umsatzanzeige") start with a block of key;value lines (IBAN, account name, period,
// balance), followed by the bookings below a "Buchung;Wertstellungsdatum;…" header.

var ingFilenameIBAN = regexp.MustCompile(`(?i)^Umsatzanzeige_([A-Z]{2}\d{2}[A-Z0-9]{10,30})_`)

func isING(content string) bool {
	return strings.HasPrefix(content, "Umsatzanzeige;") && strings.Contains(content, "\nBuchung;Wertstellungsdatum;")
}

func parseING(content, filename string) (Statement, error) {
	stmt := Statement{Bank: "ING"}

	headerAt := strings.Index(content, "\nBuchung;Wertstellungsdatum;")
	for _, line := range strings.Split(content[:headerAt], "\n") {
		key, value, ok := strings.Cut(line, ";")
		if !ok {
			continue
		}
		switch key {
		case "IBAN":
			stmt.IBAN = NormalizeIBAN(value)
		case "Kontoname":
			stmt.AccountName = strings.TrimSpace(value)
		case "Zeitraum":
			if from, to, ok := strings.Cut(value, " - "); ok {
				if f, err := parseGermanDate(from); err == nil {
					stmt.From = &f
				}
				if t, err := parseGermanDate(to); err == nil {
					stmt.To = &t
				}
			}
		case "Saldo":
			amount, _, _ := strings.Cut(value, ";")
			if v, err := parseGermanAmount(amount); err == nil {
				stmt.Balance = &v
			}
		}
	}
	if stmt.IBAN == "" {
		if m := ingFilenameIBAN.FindStringSubmatch(filepath.Base(filename)); m != nil {
			stmt.IBAN = NormalizeIBAN(m[1])
		}
	}

	reader := csv.NewReader(strings.NewReader(content[headerAt+1:]))
	reader.Comma = ';'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		return stmt, fmt.Errorf("invalid CSV: %w", err)
	}

	col := columnIndex(records[0])
	booking, value, amount := col("Buchung"), col("Wertstellungsdatum"), col("Betrag")
	if booking < 0 || amount < 0 {
		return stmt, fmt.Errorf("missing columns Buchung/Betrag")
	}
	// "Währung" appears twice: after "Saldo" and after "Betrag"
	saldo := col("Saldo")

	for i, record := range records[1:] {
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue
		}
		get := func(idx int) string {
			if idx < 0 || idx >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[idx])
		}
		t := Transaction{
			Counterparty: get(col("Auftraggeber/Empfänger")),
			BookingText:  get(col("Buchungstext")),
			Purpose:      get(col("Verwendungszweck")),
			Reference:    get(col("Referenz")),
			Currency:     get(amount + 1),
		}
		line := i + 2 + strings.Count(content[:headerAt+1], "\n")
		if t.BookingDate, err = parseGermanDate(get(booking)); err != nil {
			return stmt, fmt.Errorf("line %d: %w", line, err)
		}
		if t.ValueDate, err = parseGermanDate(get(value)); err != nil {
			t.ValueDate = t.BookingDate
		}
		if t.Amount, err = parseGermanAmount(get(amount)); err != nil {
			return stmt, fmt.Errorf("line %d: %w", line, err)
		}
		if b, err := parseGermanAmount(get(saldo)); err == nil && get(saldo) != "" {
			t.Balance = &b
		}
		stmt.Transactions = append(stmt.Transactions, t)
	}
	return stmt, nil
}

// columnIndex returns a lookup of the first column with the given header name, -1 if missing.
func columnIndex(header []string) func(string) int {
	return func(name string) int {
		for i, h := range header {
			if strings.TrimSpace(h) == name {
				return i
			}
		}
		return -1
	}
}
