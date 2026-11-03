// Package bankimport reads exported bank statements (CSV) into a bank independent form.
package bankimport

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrUnknownFormat = errors.New("unknown bank statement format")

// Statement is one exported file: the account it belongs to and its bookings.
type Statement struct {
	Bank         string
	IBAN         string // normalized, empty when the export does not contain it
	AccountName  string
	From, To     *time.Time
	Balance      *float64 // balance at export time
	Transactions []Transaction
}

// Transaction is one booking. Amount is negative for money leaving the account.
type Transaction struct {
	BookingDate      time.Time
	ValueDate        time.Time
	Counterparty     string
	CounterpartyIBAN string
	BookingText      string
	Purpose          string
	Reference        string // mandate or end-to-end reference, if the bank exports it
	CreditorID       string
	Amount           float64
	Balance          *float64 // balance after the booking
	Currency         string
}

// Parse detects the format of an export and reads it. The file name is used as fallback for
// data the content does not carry (ING puts the IBAN into the name).
func Parse(data []byte, filename string) (Statement, error) {
	content := decode(data)
	switch {
	case isING(content):
		return parseING(content, filename)
	default:
		return Statement{}, ErrUnknownFormat
	}
}

// decode returns the content as UTF-8 without BOM; exports that are no valid UTF-8 are read as
// ISO-8859-1, the encoding German banks traditionally use.
func decode(data []byte) string {
	data = bytes.TrimPrefix(data, []byte("\xEF\xBB\xBF"))
	if utf8.Valid(data) {
		return strings.ReplaceAll(string(data), "\r\n", "\n")
	}
	runes := make([]rune, len(data))
	for i, b := range data {
		runes[i] = rune(b)
	}
	return strings.ReplaceAll(string(runes), "\r\n", "\n")
}

// Fingerprint identifies a booking of an account across overlapping exports. occurrence counts
// identical bookings within one export, so two equal purchases on one day stay two bookings.
func Fingerprint(t Transaction, occurrence int) string {
	balance := ""
	if t.Balance != nil {
		balance = formatAmount(*t.Balance)
	}
	parts := []string{
		t.BookingDate.Format(time.DateOnly), t.ValueDate.Format(time.DateOnly), formatAmount(t.Amount), balance,
		normalizeSpace(t.Counterparty), normalizeSpace(t.Purpose), strconv.Itoa(occurrence),
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return hex.EncodeToString(sum[:])
}

// Fingerprints returns the fingerprint of every transaction of a statement.
func Fingerprints(transactions []Transaction) []string {
	seen := map[string]int{}
	result := make([]string, len(transactions))
	for i, t := range transactions {
		base := Fingerprint(t, 0)
		result[i] = Fingerprint(t, seen[base])
		seen[base]++
	}
	return result
}

func formatAmount(v float64) string {
	return strconv.FormatFloat(v, 'f', 2, 64)
}

func normalizeSpace(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// NormalizeIBAN removes spaces and upper-cases an IBAN; masked IBANs ("DE85 **** …") become empty.
func NormalizeIBAN(s string) string {
	iban := strings.ToUpper(strings.Join(strings.Fields(s), ""))
	if strings.Contains(iban, "*") || len(iban) < 15 {
		return ""
	}
	return iban
}

// parseGermanAmount reads amounts like "-1.234,56".
func parseGermanAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", ".")
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount %q", s)
	}
	return v, nil
}

func parseGermanDate(s string) (time.Time, error) {
	t, err := time.Parse("02.01.2006", strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q", s)
	}
	return t, nil
}
