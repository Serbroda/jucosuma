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

type ContractDto struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	Company          *string    `json:"company"`
	ContractType     string     `json:"contract_type"`
	Category         string     `json:"category"`
	StartDate        DateOnly   `json:"start_date"`
	EndDate          *DateOnly  `json:"end_date"`
	ContractNumber   *string    `json:"contract_number"`
	CustomerNumber   *string    `json:"customer_number"`
	ContractHolderID *int64     `json:"contract_holder_id"`
	Costs            *float64   `json:"costs"`
	BillingPeriod    string     `json:"billing_period"`
	IconSource       *string    `json:"icon_source"`
	Notes            *string    `json:"notes"`
	CreatedAt        *time.Time `json:"created_at"`
	UpdatedAt        *time.Time `json:"updated_at"`
}

type CreateContractDto struct {
	Name           string    `json:"name"`
	Company        *string   `json:"company"`
	ContractType   string    `json:"contract_type"`
	Category       string    `json:"category"`
	StartDate      DateOnly  `json:"start_date"`
	EndDate        *DateOnly `json:"end_date"`
	ContractNumber *string   `json:"contract_number"`
	CustomerNumber *string   `json:"customer_number"`
	Costs          *float64  `json:"costs"`
	BillingPeriod  string    `json:"billing_period"`
	IconSource     *string   `json:"icon_source"`
	Notes          *string   `json:"notes"`
}

type UpdateContractDto struct {
	Name           string    `json:"name"`
	Company        *string   `json:"company"`
	ContractType   string    `json:"contract_type"`
	Category       string    `json:"category"`
	StartDate      DateOnly  `json:"start_date"`
	EndDate        *DateOnly `json:"end_date"`
	ContractNumber *string   `json:"contract_number"`
	CustomerNumber *string   `json:"customer_number"`
	Costs          *float64  `json:"costs"`
	BillingPeriod  string    `json:"billing_period"`
	IconSource     *string   `json:"icon_source"`
	Notes          *string   `json:"notes"`
}
