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

type ContractStatus string

const (
	ContractStatusActive    ContractStatus = "active"
	ContractStatusCancelled ContractStatus = "cancelled"
	ContractStatusExpired   ContractStatus = "expired"
)

type ContractDto struct {
	ID              int64          `json:"id"`
	Name            string         `json:"name"`
	Company         *string        `json:"company"`
	Category        string         `json:"category"`
	StartDate       DateOnly       `json:"start_date"`
	EndDate         *DateOnly      `json:"end_date"`
	ContractNumber  *string        `json:"contract_number"`
	CustomerNumber  *string        `json:"customer_number"`
	ContractHolder  *string        `json:"contract_holder"`
	BillingPeriod   string         `json:"billing_period"`
	Costs           *float64       `json:"costs"`
	Currency        *string        `json:"currency"`
	NextBillingDate *DateOnly      `json:"next_billing_date"`
	Status          ContractStatus `json:"status"`
	MonthlyCosts    *float64       `json:"monthly_costs"`
	ContactPerson   *string        `json:"contact_person"`
	ContactAddress  *string        `json:"contact_address"`
	ContactPhone    *string        `json:"contact_phone"`
	ContactEmail    *string        `json:"contact_email"`
	IconSource      *string        `json:"icon_source"`
	Notes           *string        `json:"notes"`
	OwnerID         *int64         `json:"owner_id"`
	SplitBetween    int64          `json:"split_between"`
	CreatedAt       *time.Time     `json:"created_at"`
	UpdatedAt       *time.Time     `json:"updated_at"`
	Documents       []DocumentDto  `json:"documents"`
}

type CreateContractDto struct {
	Name            string    `json:"name" validate:"required,min=1,max=256"`
	Company         *string   `json:"company"`
	Category        string    `json:"category"`
	StartDate       DateOnly  `json:"start_date"`
	EndDate         *DateOnly `json:"end_date"`
	ContractNumber  *string   `json:"contract_number"`
	CustomerNumber  *string   `json:"customer_number"`
	ContractHolder  *string   `json:"contract_holder"`
	BillingPeriod   string    `json:"billing_period"`
	Costs           *float64  `json:"costs"`
	Currency        *string   `json:"currency"`
	NextBillingDate *DateOnly `json:"next_billing_date"`
	ContactPerson   *string   `json:"contact_person"`
	ContactAddress  *string   `json:"contact_address"`
	ContactPhone    *string   `json:"contact_phone"`
	ContactEmail    *string   `json:"contact_email"`
	IconSource      *string   `json:"icon_source"`
	Notes           *string   `json:"notes"`
	OwnerID         *int64    `json:"owner_id"`
	SplitBetween    int64     `json:"split_between"`
}

type UpdateContractDto struct {
	Name            string    `json:"name" validate:"required,min=1,max=256"`
	Company         *string   `json:"company"`
	Category        string    `json:"category"`
	StartDate       DateOnly  `json:"start_date"`
	EndDate         *DateOnly `json:"end_date"`
	ContractNumber  *string   `json:"contract_number"`
	CustomerNumber  *string   `json:"customer_number"`
	ContractHolder  *string   `json:"contract_holder"`
	BillingPeriod   string    `json:"billing_period"`
	Costs           *float64  `json:"costs"`
	Currency        *string   `json:"currency"`
	NextBillingDate *DateOnly `json:"next_billing_date"`
	ContactPerson   *string   `json:"contact_person"`
	ContactAddress  *string   `json:"contact_address"`
	ContactPhone    *string   `json:"contact_phone"`
	ContactEmail    *string   `json:"contact_email"`
	IconSource      *string   `json:"icon_source"`
	Notes           *string   `json:"notes"`
	OwnerID         *int64    `json:"owner_id"`
	SplitBetween    int64     `json:"split_between"`
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

type LoginDto struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
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
	Name      string     `json:"name"`
	SortOrder int64      `json:"sort_order"`
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

type CreateCategoryDto struct {
	Name      string `json:"name" validate:"required,min=1,max=128"`
	SortOrder int64  `json:"sort_order"`
}

type UpdateCategoryDto struct {
	Name      string `json:"name" validate:"required,min=1,max=128"`
	SortOrder int64  `json:"sort_order"`
}
