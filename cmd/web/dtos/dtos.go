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
	BillingPeriodWeekly        BillingPeriod = "weekly"
	BillingPeriodMonthly       BillingPeriod = "monthly"
	BillingPeriodQuarterly     BillingPeriod = "quarterly"
	BillingPeriodSemiannual    BillingPeriod = "semiannually"
	BillingPeriodAnnually      BillingPeriod = "annually"
	BillingPeriodEveryTwoYears BillingPeriod = "every_two_years"
)

type ContractDto struct {
	ID               int64         `json:"id"`
	Name             string        `json:"name"`
	Company          *string       `json:"company"`
	ContractType     string        `json:"contract_type"`
	Category         string        `json:"category"`
	StartDate        DateOnly      `json:"start_date"`
	EndDate          *DateOnly     `json:"end_date"`
	ContractNumber   *string       `json:"contract_number"`
	CustomerNumber   *string       `json:"customer_number"`
	ContractHolderID *int64        `json:"contract_holder_id"`
	Costs            *float64      `json:"costs"`
	BillingPeriod    string        `json:"billing_period"`
	ContactPerson    *string       `json:"contact_person"`
	ContactAddress   *string       `json:"contact_address"`
	ContactPhone     *string       `json:"contact_phone"`
	ContactEmail     *string       `json:"contact_email"`
	IconSource       *string       `json:"icon_source"`
	Notes            *string       `json:"notes"`
	CreatedAt        *time.Time    `json:"created_at"`
	UpdatedAt        *time.Time    `json:"updated_at"`
	Documents        []DocumentDto `json:"documents"`
}

type CreateContractDto struct {
	Name           string    `json:"name" validate:"required,min=1,max=256"`
	Company        *string   `json:"company"`
	ContractType   string    `json:"contract_type" validate:"required,min=1,max=256"`
	Category       string    `json:"category"`
	StartDate      DateOnly  `json:"start_date"`
	EndDate        *DateOnly `json:"end_date"`
	ContractNumber *string   `json:"contract_number"`
	CustomerNumber *string   `json:"customer_number"`
	Costs          *float64  `json:"costs"`
	BillingPeriod  string    `json:"billing_period"`
	ContactPerson  *string   `json:"contact_person"`
	ContactAddress *string   `json:"contact_address"`
	ContactPhone   *string   `json:"contact_phone"`
	ContactEmail   *string   `json:"contact_email"`
	IconSource     *string   `json:"icon_source"`
	Notes          *string   `json:"notes"`
}

type UpdateContractDto struct {
	Name           string    `json:"name" validate:"required,min=1,max=256"`
	Company        *string   `json:"company"`
	ContractType   string    `json:"contract_type" validate:"required,min=1,max=256"`
	Category       string    `json:"category"`
	StartDate      DateOnly  `json:"start_date"`
	EndDate        *DateOnly `json:"end_date"`
	ContractNumber *string   `json:"contract_number"`
	CustomerNumber *string   `json:"customer_number"`
	Costs          *float64  `json:"costs"`
	BillingPeriod  string    `json:"billing_period"`
	ContactPerson  *string   `json:"contact_person"`
	ContactAddress *string   `json:"contact_address"`
	ContactPhone   *string   `json:"contact_phone"`
	ContactEmail   *string   `json:"contact_email"`
	IconSource     *string   `json:"icon_source"`
	Notes          *string   `json:"notes"`
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
