package dtos

import "time"

// Bank statement import. Bookings are only ever returned to the user who uploaded them.

type BankImportResultDto struct {
	ImportID   *int64    `json:"import_id"` // nil for a preview
	Bank       string    `json:"bank"`
	Iban       string    `json:"iban"`
	AccountID  *int64    `json:"account_id"` // nil when no account matches the IBAN: the client asks for one
	PeriodFrom *DateOnly `json:"period_from"`
	PeriodTo   *DateOnly `json:"period_to"`
	Balance    *float64  `json:"balance"`
	Scope      string    `json:"scope"`
	Total      int       `json:"total"`
	Imported   int       `json:"imported"`
	Duplicates int       `json:"duplicates"`
}

type BankImportDto struct {
	ID         int64      `json:"id"`
	AccountID  int64      `json:"account_id"`
	Bank       string     `json:"bank"`
	Filename   string     `json:"filename"`
	PeriodFrom *DateOnly  `json:"period_from"`
	PeriodTo   *DateOnly  `json:"period_to"`
	Imported   int64      `json:"imported"`
	Duplicates int64      `json:"duplicates"`
	CreatedAt  *time.Time `json:"created_at"`
	Total      int64      `json:"total"`
	Classified int64      `json:"classified"`
	ClosedAt   *time.Time `json:"closed_at"`
	// PurgeOn is when the raw details of a closed import are removed; PurgedAt when that happened
	PurgeOn  *DateOnly  `json:"purge_on"`
	PurgedAt *time.Time `json:"purged_at"`
}

type BankTransactionDto struct {
	ID               int64    `json:"id"`
	ImportID         int64    `json:"import_id"`
	AccountID        int64    `json:"account_id"`
	BookingDate      DateOnly `json:"booking_date"`
	ValueDate        DateOnly `json:"value_date"`
	Counterparty     string   `json:"counterparty"`
	CounterpartyIban *string  `json:"counterparty_iban"`
	BookingText      string   `json:"booking_text"`
	Purpose          string   `json:"purpose"`
	Reference        *string  `json:"reference"`
	Amount           float64  `json:"amount"`
	BalanceAfter     *float64 `json:"balance_after"`
	Currency         string   `json:"currency"`
	Scope            string   `json:"scope"`
	Kind             *string  `json:"kind"`
	CategoryID       *int64   `json:"category_id"`
	ContractID       *int64   `json:"contract_id"`
	ClassifiedBy     *string  `json:"classified_by"`
}

// UpdateBankTransactionsDto classifies several own bookings at once; fields left out stay unchanged.
// A planned entry (e.g. the variable cost "groceries") links the bookings to it and sets its
// category; a category alone removes such a link.
type UpdateBankTransactionsDto struct {
	IDs           []int64 `json:"ids" validate:"required,min=1,max=1000"`
	Scope         *string `json:"scope" validate:"omitempty,oneof=HOUSEHOLD PRIVATE"`
	CategoryID    *int64  `json:"category_id"`
	ContractID    *int64  `json:"contract_id"`
	ClearCategory bool    `json:"clear_category"`
}

// BankSettingsDto: months after closing an import until counterparty, purpose etc. are removed
// (0 = right away).
type BankSettingsDto struct {
	RawRetentionMonths int `json:"raw_retention_months" validate:"min=0,max=120"`
}
