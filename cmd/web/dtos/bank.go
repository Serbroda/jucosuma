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
	ImportID         *int64   `json:"import_id"` // nil: entered by hand
	AccountID        *int64   `json:"account_id"`
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

// BankActualsDto are the totals of a month's bookings that count for the household, of all members.
// Amounts are spending: positive for money going out, refunds reduce them. No single booking is
// included; everybody sees only their own bookings elsewhere.
type BankActualsDto struct {
	Month      string                   `json:"month"`
	Categories []BankCategoryActualDto  `json:"categories"`
	Unassigned BankAmountDto            `json:"unassigned"` // money going out without category
	Coverage   []BankAccountCoverageDto `json:"coverage"`
	// balances at the end of the month, for accounts whose imports cover the whole month
	Balances []BankBalanceDto `json:"balances"`
}

type BankBalanceDto struct {
	AccountID int64    `json:"account_id"`
	Balance   float64  `json:"balance"`
	Date      DateOnly `json:"date"` // day of the last booking
}

type BankAmountDto struct {
	Amount   float64 `json:"amount"`
	Bookings int64   `json:"bookings"`
}

type BankCategoryActualDto struct {
	CategoryID int64               `json:"category_id"`
	Amount     float64             `json:"amount"`
	Bookings   int64               `json:"bookings"`
	ByUser     []BankUserActualDto `json:"by_user"`
	// entries linked to bookings of this category, e.g. groceries and drugstore sharing one category
	Entries []BankEntryActualDto `json:"entries"`
}

type BankUserActualDto struct {
	UserID   int64   `json:"user_id"`
	Name     string  `json:"name"`
	Amount   float64 `json:"amount"`
	Bookings int64   `json:"bookings"`
}

type BankEntryActualDto struct {
	ContractID int64   `json:"contract_id"`
	Amount     float64 `json:"amount"`
	Bookings   int64   `json:"bookings"`
}

// BankAccountCoverageDto tells whether imports cover the whole month of an account; without it the
// totals miss bookings.
type BankAccountCoverageDto struct {
	AccountID int64 `json:"account_id"`
	Complete  bool  `json:"complete"`
	// last day covered within the month, nil when no import touches it
	CoveredUntil *DateOnly `json:"covered_until"`
}

// SaveManualBankTransactionDto is a booking entered by hand, e.g. cash spending. Amount is negative
// for money going out; without account it is cash.
type SaveManualBankTransactionDto struct {
	BookingDate  *DateOnly `json:"booking_date" validate:"required"`
	Amount       float64   `json:"amount" validate:"ne=0"`
	Counterparty string    `json:"counterparty" validate:"required,max=200"`
	Purpose      string    `json:"purpose" validate:"max=500"`
	AccountID    *int64    `json:"account_id"`
	Scope        string    `json:"scope" validate:"oneof=HOUSEHOLD PRIVATE"`
	CategoryID   *int64    `json:"category_id"`
	ContractID   *int64    `json:"contract_id"`
}

// MoveBankImportDto moves an import with its bookings to another account, e.g. after picking the
// wrong one; assignments and scopes stay.
type MoveBankImportDto struct {
	AccountID int64 `json:"account_id" validate:"required"`
}
