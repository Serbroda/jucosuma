package bankimport

import (
	"strings"
	"testing"
	"time"
)

const ingSample = `Umsatzanzeige;Datei erstellt am: 03.11.2026 10:51

IBAN;DE85 **** **** **** ** ***
Kontoname;Girokonto
Bank;ING
Kunde;Person A, Person B
Zeitraum;03.10.2026 - 03.11.2026
Saldo;2.681,80;EUR

Sortierung;Datum absteigend

In der CSV-Datei finden Sie alle bereits gebuchten Umsätze.

Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Referenz;Saldo;Währung;Betrag;Währung
02.11.2026;02.11.2026;VISA SUPERMARKT;Lastschrift;NR XXXX 9011 HAMBURG DE KAUFUMSATZ 29.10 18.06;;1.438,10;EUR;-18,06;EUR
02.11.2026;02.11.2026;VISA SUPERMARKT;Lastschrift;NR XXXX 9011 HAMBURG DE KAUFUMSATZ 29.10 18.06;;1.438,10;EUR;-18,06;EUR
29.10.2026;29.10.2026;Person B;Gutschrift aus Dauerauftrag;Miete + Haushaltsgeld;;1.604,30;EUR;750,00;EUR
05.10.2026;04.10.2026;Vermieter GmbH;Lastschrift;Miete 10/2026;MANDAT-1;154,88;EUR;-1.002,08;EUR
`

func TestParseING(t *testing.T) {
	stmt, err := Parse([]byte(ingSample), "Umsatzanzeige_DE89370400440532013000_20261103.csv")
	if err != nil {
		t.Fatal(err)
	}
	if stmt.Bank != "ING" || stmt.AccountName != "Girokonto" {
		t.Errorf("bank/account = %q/%q", stmt.Bank, stmt.AccountName)
	}
	if stmt.IBAN != "DE89370400440532013000" {
		t.Errorf("IBAN from file name = %q", stmt.IBAN)
	}
	if stmt.Balance == nil || *stmt.Balance != 2681.80 {
		t.Errorf("balance = %v", stmt.Balance)
	}
	if stmt.From == nil || stmt.From.Format(time.DateOnly) != "2026-10-03" || stmt.To.Format(time.DateOnly) != "2026-11-03" {
		t.Errorf("period = %v - %v", stmt.From, stmt.To)
	}
	if len(stmt.Transactions) != 4 {
		t.Fatalf("got %d transactions", len(stmt.Transactions))
	}

	rent := stmt.Transactions[3]
	if rent.Amount != -1002.08 || rent.Counterparty != "Vermieter GmbH" || rent.Reference != "MANDAT-1" || rent.Currency != "EUR" {
		t.Errorf("rent = %+v", rent)
	}
	if rent.BookingDate.Format(time.DateOnly) != "2026-10-05" || rent.ValueDate.Format(time.DateOnly) != "2026-10-04" {
		t.Errorf("dates = %v / %v", rent.BookingDate, rent.ValueDate)
	}
	if rent.Balance == nil || *rent.Balance != 154.88 {
		t.Errorf("balance after = %v", rent.Balance)
	}
	if stmt.Transactions[2].Amount != 750 {
		t.Errorf("income = %v", stmt.Transactions[2].Amount)
	}
}

func TestParseINGLatin1(t *testing.T) {
	latin1 := make([]byte, 0, len(ingSample))
	for _, r := range ingSample {
		latin1 = append(latin1, byte(r))
	}
	stmt, err := Parse(latin1, "export.csv")
	if err != nil {
		t.Fatal(err)
	}
	if stmt.IBAN != "" {
		t.Errorf("masked IBAN without file name should stay empty, got %q", stmt.IBAN)
	}
	if got := stmt.Transactions[2].Counterparty; got != "Person B" {
		t.Errorf("counterparty = %q", got)
	}
}

func TestFingerprints(t *testing.T) {
	stmt, err := Parse([]byte(ingSample), "export.csv")
	if err != nil {
		t.Fatal(err)
	}
	fps := Fingerprints(stmt.Transactions)
	if fps[0] == fps[1] {
		t.Error("two identical bookings in one export need distinct fingerprints")
	}
	// a later, overlapping export yields the same fingerprints for the same bookings
	again, _ := Parse([]byte(ingSample), "other.csv")
	if Fingerprints(again.Transactions)[3] != fps[3] {
		t.Error("fingerprint not stable across exports")
	}
}

func TestParseUnknownFormat(t *testing.T) {
	if _, err := Parse([]byte("a;b;c\n1;2;3\n"), "x.csv"); err != ErrUnknownFormat {
		t.Errorf("err = %v", err)
	}
	if !strings.Contains(ErrUnknownFormat.Error(), "unknown") {
		t.Fail()
	}
}
