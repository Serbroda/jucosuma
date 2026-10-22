package dtos

import (
	"fmt"
	"strings"
	"time"
)

type DateOnly time.Time

func (d *DateOnly) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return fmt.Errorf("invalid date %q: %w", s, err)
	}
	*d = DateOnly(t)
	return nil
}

func (d DateOnly) MarshalJSON() ([]byte, error) {
	t := time.Time(d)
	return []byte(`"` + t.Format("2006-01-02") + `"`), nil
}

type LogoDto struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type BillingPeriod string

const (
	BillingPeriodNone          BillingPeriod = "none"
	BillingPeriodOneTime       BillingPeriod = "one_time"
	BillingPeriodWeekly        BillingPeriod = "weekly"
	BillingPeriodMonthly       BillingPeriod = "monthly"
	BillingPeriodQuarterly     BillingPeriod = "quarterly"
	BillingPeriodSemiannual    BillingPeriod = "semiannually"
	BillingPeriodAnnually      BillingPeriod = "annually"
	BillingPeriodEveryTwoYears BillingPeriod = "every_two_years"
)

type EntryKind string

const (
	EntryKindExpense  EntryKind = "expense"
	EntryKindIncome   EntryKind = "income"
	EntryKindTransfer EntryKind = "transfer"
)

type AccountType string

const (
	AccountTypeChecking AccountType = "checking"
	AccountTypeSavings  AccountType = "savings"
	AccountTypeDepot    AccountType = "depot"
	AccountTypeCash     AccountType = "cash"
	AccountTypeOther    AccountType = "other"
)

// TransferType tells what a transfer does with the money.
type TransferType string

const (
	TransferTypeSaving     TransferType = "saving"     // money is set aside: counts as savings
	TransferTypeWithdrawal TransferType = "withdrawal" // money comes back from the savings
	TransferTypeMove       TransferType = "move"       // money only changes account or pot
)

type NoticeUnit string

const (
	NoticeUnitDays   NoticeUnit = "days"
	NoticeUnitWeeks  NoticeUnit = "weeks"
	NoticeUnitMonths NoticeUnit = "months"
)

type ContractStatus string

const (
	ContractStatusActive    ContractStatus = "active"
	ContractStatusCancelled ContractStatus = "cancelled"
	ContractStatusExpired   ContractStatus = "expired"
)

type ContractDto struct {
	ID              int64               `json:"id"`
	Name            string              `json:"name"`
	Company         *string             `json:"company"`
	Category        string              `json:"category"`
	CategoryID      *int64              `json:"category_id"`
	CategoryKey     *string             `json:"category_key"`
	IsContract      bool                `json:"is_contract"`
	IsVariable      bool                `json:"is_variable"`
	TermMonths      *int64              `json:"term_months"`
	NoticePeriod    *int64              `json:"notice_period"`
	NoticeUnit      *NoticeUnit         `json:"notice_unit"`
	TermEnd         *DateOnly           `json:"term_end"`
	CancelBy        *DateOnly           `json:"cancel_by"`
	StartDate       DateOnly            `json:"start_date"`
	EndDate         *DateOnly           `json:"end_date"`
	ContractNumber  *string             `json:"contract_number"`
	CustomerNumber  *string             `json:"customer_number"`
	ContractHolder  *string             `json:"contract_holder"`
	BillingPeriod   string              `json:"billing_period"`
	Costs           *float64            `json:"costs"`
	Currency        *string             `json:"currency"`
	NextBillingDate *DateOnly           `json:"next_billing_date"`
	Status          ContractStatus      `json:"status"`
	MonthlyCosts    *float64            `json:"monthly_costs"`
	ContactPerson   *string             `json:"contact_person"`
	ContactAddress  *string             `json:"contact_address"`
	ContactPhone    *string             `json:"contact_phone"`
	ContactEmail    *string             `json:"contact_email"`
	IconSource      *string             `json:"icon_source"`
	Notes           *string             `json:"notes"`
	OwnerID         *int64              `json:"owner_id"`
	SplitBetween    int64               `json:"split_between"`
	Kind            EntryKind           `json:"kind"`
	AccountID       *int64              `json:"account_id"`
	TargetAccountID *int64              `json:"target_account_id"`
	GoalID          *int64              `json:"goal_id"`
	TransferType    *TransferType       `json:"transfer_type"`
	Shares          []ShareDto          `json:"shares"`
	HouseholdShare  float64             `json:"household_share"`
	MonthlyAmount   *float64            `json:"monthly_amount"`
	BaseCosts       *float64            `json:"base_costs"`
	Amounts         []ContractAmountDto `json:"amounts"`
	CreatedAt       *time.Time          `json:"created_at"`
	UpdatedAt       *time.Time          `json:"updated_at"`
	Website         *string             `json:"website"`
	Links           []ContractLinkDto   `json:"links"`
	Documents       []DocumentDto       `json:"documents"`
}

type CreateContractDto struct {
	Name            string     `json:"name" validate:"required,min=1,max=256"`
	Company         *string    `json:"company"`
	Category        string     `json:"category"`
	CategoryID      *int64     `json:"category_id"`
	IsContract      bool       `json:"is_contract"`
	IsVariable      *bool      `json:"is_variable"` // nil (older exports): every non-contract expense is variable
	TermMonths      *int64     `json:"term_months" validate:"omitempty,min=1,max=120"`
	NoticePeriod    *int64     `json:"notice_period" validate:"omitempty,min=0,max=365"`
	NoticeUnit      *string    `json:"notice_unit" validate:"omitempty,oneof=days weeks months"`
	StartDate       DateOnly   `json:"start_date"`
	EndDate         *DateOnly  `json:"end_date"`
	ContractNumber  *string    `json:"contract_number"`
	CustomerNumber  *string    `json:"customer_number"`
	ContractHolder  *string    `json:"contract_holder"`
	BillingPeriod   string     `json:"billing_period"`
	Costs           *float64   `json:"costs"`
	Currency        *string    `json:"currency"`
	NextBillingDate *DateOnly  `json:"next_billing_date"`
	ContactPerson   *string    `json:"contact_person"`
	ContactAddress  *string    `json:"contact_address"`
	ContactPhone    *string    `json:"contact_phone"`
	ContactEmail    *string    `json:"contact_email"`
	Website         *string    `json:"website"`
	IconSource      *string    `json:"icon_source"`
	Notes           *string    `json:"notes"`
	OwnerID         *int64     `json:"owner_id"`
	SplitBetween    int64      `json:"split_between"`
	Kind            EntryKind  `json:"kind"`
	AccountID       *int64     `json:"account_id"`
	TargetAccountID *int64     `json:"target_account_id"`
	GoalID          *int64     `json:"goal_id"`
	TransferType    *string    `json:"transfer_type" validate:"omitempty,oneof=saving withdrawal move"`
	Shares          []ShareDto `json:"shares"`
	// Links replaces all links of the entry; nil keeps the existing ones.
	Links *[]ContractLinkDto `json:"links"`
	// Amounts (amount history) is only read by the JSON import; the form uses its own endpoints.
	Amounts []ContractAmountDto `json:"amounts"`
	// BaseCosts is the amount from the start date when the export has an amount history.
	BaseCosts *float64 `json:"base_costs"`
}

type UpdateContractDto struct {
	Name            string     `json:"name" validate:"required,min=1,max=256"`
	Company         *string    `json:"company"`
	Category        string     `json:"category"`
	CategoryID      *int64     `json:"category_id"`
	IsContract      bool       `json:"is_contract"`
	IsVariable      *bool      `json:"is_variable"`
	TermMonths      *int64     `json:"term_months" validate:"omitempty,min=1,max=120"`
	NoticePeriod    *int64     `json:"notice_period" validate:"omitempty,min=0,max=365"`
	NoticeUnit      *string    `json:"notice_unit" validate:"omitempty,oneof=days weeks months"`
	StartDate       DateOnly   `json:"start_date"`
	EndDate         *DateOnly  `json:"end_date"`
	ContractNumber  *string    `json:"contract_number"`
	CustomerNumber  *string    `json:"customer_number"`
	ContractHolder  *string    `json:"contract_holder"`
	BillingPeriod   string     `json:"billing_period"`
	Costs           *float64   `json:"costs"`
	Currency        *string    `json:"currency"`
	NextBillingDate *DateOnly  `json:"next_billing_date"`
	ContactPerson   *string    `json:"contact_person"`
	ContactAddress  *string    `json:"contact_address"`
	ContactPhone    *string    `json:"contact_phone"`
	ContactEmail    *string    `json:"contact_email"`
	Website         *string    `json:"website"`
	IconSource      *string    `json:"icon_source"`
	Notes           *string    `json:"notes"`
	OwnerID         *int64     `json:"owner_id"`
	SplitBetween    int64      `json:"split_between"`
	Kind            EntryKind  `json:"kind"`
	AccountID       *int64     `json:"account_id"`
	TargetAccountID *int64     `json:"target_account_id"`
	GoalID          *int64     `json:"goal_id"`
	TransferType    *string    `json:"transfer_type" validate:"omitempty,oneof=saving withdrawal move"`
	Shares          []ShareDto `json:"shares"`
}

type DocumentDto struct {
	ID         int64      `json:"id"`
	ContractID int64      `json:"contract_id"`
	Path       string     `json:"path"`
	Title      *string    `json:"title"`
	CreatedAt  *time.Time `json:"created_at"`
	UpdatedAt  *time.Time `json:"updated_at"`
}

type UpdateDocumentDto struct {
	Title string `json:"title"`
}

type ContractHolderDto struct {
	Name string `json:"name"`
}

type CompanyDto struct {
	Name string `json:"name"`
}

type LoginDto struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type UpdatePreferencesDto struct {
	Language *string `json:"language" validate:"omitempty,oneof=en de"`
}

type ChangePasswordDto struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

type UserDto struct {
	ID                 int64      `json:"id"`
	Username           string     `json:"username"`
	Role               string     `json:"role"`
	MustChangePassword bool       `json:"must_change_password"`
	Language           *string    `json:"language"`
	CreatedAt          *time.Time `json:"created_at"`
	UpdatedAt          *time.Time `json:"updated_at"`
}

type CreateUserDto struct {
	Username string `json:"username" validate:"required,min=1,max=64"`
	Password string `json:"password" validate:"required,min=8"`
	Role     string `json:"role" validate:"required,oneof=admin user"`
}

type UpdateUserDto struct {
	Username string `json:"username" validate:"required,min=1,max=64"`
	Role     string `json:"role" validate:"required,oneof=admin user"`
}

type ResetPasswordDto struct {
	Password string `json:"password" validate:"required,min=8"`
}

type CategoryDto struct {
	ID        int64      `json:"id"`
	Key       *string    `json:"key"`
	Name      string     `json:"name"`
	Type      EntryKind  `json:"type"`
	Color     *int64     `json:"color"`
	Icon      *string    `json:"icon"`
	SortOrder int64      `json:"sort_order"`
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

type CreateCategoryDto struct {
	Name      string  `json:"name" validate:"required,min=1,max=128"`
	SortOrder int64   `json:"sort_order"`
	Type      string  `json:"type" validate:"omitempty,oneof=expense income"`
	Color     *int64  `json:"color" validate:"omitempty,min=1,max=8"`
	Icon      *string `json:"icon" validate:"omitempty,max=32"`
}

type UpdateCategoryDto struct {
	Name      string  `json:"name" validate:"required,min=1,max=128"`
	SortOrder int64   `json:"sort_order"`
	Type      string  `json:"type" validate:"omitempty,oneof=expense income"`
	Color     *int64  `json:"color" validate:"omitempty,min=1,max=8"`
	Icon      *string `json:"icon" validate:"omitempty,max=32"`
}

type ShareDto struct {
	PersonID int64   `json:"person_id"`
	Weight   float64 `json:"weight"`
}

type PersonDto struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	InHousehold bool       `json:"in_household"`
	UserID      *int64     `json:"user_id"`
	SortOrder   int64      `json:"sort_order"`
	CreatedAt   *time.Time `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at"`
}

type SavePersonDto struct {
	Name        string `json:"name" validate:"required,min=1,max=128"`
	InHousehold bool   `json:"in_household"`
	UserID      *int64 `json:"user_id"`
	SortOrder   int64  `json:"sort_order"`
}

type AccountDto struct {
	ID          int64       `json:"id"`
	Name        string      `json:"name"`
	Type        AccountType `json:"type"`
	PersonID    *int64      `json:"person_id"`
	SortOrder   int64       `json:"sort_order"`
	IsSavings   bool        `json:"is_savings"`
	Iban        *string     `json:"iban"`
	Balance     *float64    `json:"balance"`
	BalanceDate *DateOnly   `json:"balance_date"`
	GoalAmount  *float64    `json:"goal_amount"`
	GoalDate    *DateOnly   `json:"goal_date"`
	Icon        *string     `json:"icon"`
	Color       *int64      `json:"color"`
	CreatedAt   *time.Time  `json:"created_at"`
	UpdatedAt   *time.Time  `json:"updated_at"`
}

type SaveAccountDto struct {
	Name        string    `json:"name" validate:"required,min=1,max=128"`
	Type        string    `json:"type" validate:"required,oneof=checking savings depot cash other"`
	PersonID    *int64    `json:"person_id"`
	SortOrder   int64     `json:"sort_order"`
	IsSavings   *bool     `json:"is_savings"`
	Iban        *string   `json:"iban"`
	Balance     *float64  `json:"balance"`
	BalanceDate *DateOnly `json:"balance_date"`
	GoalAmount  *float64  `json:"goal_amount"`
	GoalDate    *DateOnly `json:"goal_date"`
	Icon        *string   `json:"icon" validate:"omitempty,max=32"`
	Color       *int64    `json:"color" validate:"omitempty,min=1,max=8"`
}

type UserOptionDto struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

type GoalKind string

const (
	GoalKindSaving    GoalKind = "saving"
	GoalKindInvesting GoalKind = "investing"
)

type SavingsGoalDto struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	Kind          GoalKind   `json:"kind"`
	Icon          *string    `json:"icon"`
	Color         *int64     `json:"color"`
	PersonID      *int64     `json:"person_id"`
	AccountID     *int64     `json:"account_id"`
	TargetAmount  *float64   `json:"target_amount"`
	TargetDate    *DateOnly  `json:"target_date"`
	CurrentAmount *float64   `json:"current_amount"`
	CurrentDate   *DateOnly  `json:"current_date"`
	SortOrder     int64      `json:"sort_order"`
	CreatedAt     *time.Time `json:"created_at"`
	UpdatedAt     *time.Time `json:"updated_at"`
}

type SaveSavingsGoalDto struct {
	Name          string    `json:"name" validate:"required,min=1,max=128"`
	Kind          string    `json:"kind" validate:"omitempty,oneof=saving investing"`
	Icon          *string   `json:"icon" validate:"omitempty,max=32"`
	Color         *int64    `json:"color" validate:"omitempty,min=1,max=8"`
	PersonID      *int64    `json:"person_id"`
	AccountID     *int64    `json:"account_id"`
	TargetAmount  *float64  `json:"target_amount"`
	TargetDate    *DateOnly `json:"target_date"`
	CurrentAmount *float64  `json:"current_amount"`
	CurrentDate   *DateOnly `json:"current_date"`
	SortOrder     int64     `json:"sort_order"`
}

type ClosingBalanceDto struct {
	AccountID int64   `json:"account_id" validate:"required"`
	Balance   float64 `json:"balance"`
}

type ClosingActualDto struct {
	CategoryID int64   `json:"category_id" validate:"required"`
	Amount     float64 `json:"amount"`
}

type MonthClosingDto struct {
	ID        int64               `json:"id"`
	Month     string              `json:"month"`
	Notes     *string             `json:"notes"`
	CreatedBy *int64              `json:"created_by"`
	CreatedAt *time.Time          `json:"created_at"`
	UpdatedAt *time.Time          `json:"updated_at"`
	Balances  []ClosingBalanceDto `json:"balances"`
	Actuals   []ClosingActualDto  `json:"actuals"`
}

type SaveMonthClosingDto struct {
	Notes    *string             `json:"notes"`
	Balances []ClosingBalanceDto `json:"balances" validate:"dive"`
	Actuals  []ClosingActualDto  `json:"actuals" validate:"dive"`
}

// ContractAmountDto is an amount change: from valid_from on, the entry costs `costs`.
type ContractAmountDto struct {
	ID        int64    `json:"id"`
	ValidFrom DateOnly `json:"valid_from"`
	Costs     float64  `json:"costs"`
}

type SaveContractAmountDto struct {
	ValidFrom DateOnly `json:"valid_from"`
	Costs     *float64 `json:"costs" validate:"required"`
}

// ContractLinkDto is a link of an entry, e.g. a customer portal or a document in Paperless.
type ContractLinkDto struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

// Variable tells whether an expense counts as variable cost. Contracts are always fixed; without an
// explicit value (older clients or exports) every expense that is no contract is variable.
func (d CreateContractDto) Variable() bool {
	if d.IsContract {
		return false
	}
	if d.IsVariable == nil {
		return true
	}
	return *d.IsVariable
}

// BackupSettingsDto are the backup settings of the installation, maintained by admins.
type BackupSettingsDto struct {
	Enabled   bool            `json:"enabled"`
	Keep      int             `json:"keep"`
	Directory string          `json:"directory"`
	Backups   []BackupFileDto `json:"backups"`
}

type BackupFileDto struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	Created time.Time `json:"created"`
}

type SaveBackupSettingsDto struct {
	Enabled bool `json:"enabled"`
	Keep    int  `json:"keep" validate:"min=1,max=365"`
}
