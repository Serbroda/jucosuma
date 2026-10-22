package dtos

import (
	"testing"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

func TestApplyAmounts(t *testing.T) {
	now := today()
	past, future := now.AddDate(0, -2, 0), now.AddDate(0, 3, 0)

	tests := []struct {
		name        string
		amounts     []sqlc.ContractAmount
		wantCosts   float64
		wantMonthly float64
	}{
		{"no changes keeps the base amount", nil, 100, 50},
		{"past change applies", []sqlc.ContractAmount{{ID: 1, ValidFrom: past, Costs: 120}}, 120, 60},
		{"future change does not apply yet", []sqlc.ContractAmount{{ID: 1, ValidFrom: future, Costs: 150}}, 100, 50},
		{"latest past change wins", []sqlc.ContractAmount{
			{ID: 1, ValidFrom: past.AddDate(0, -1, 0), Costs: 110},
			{ID: 2, ValidFrom: past, Costs: 120},
			{ID: 3, ValidFrom: future, Costs: 150},
		}, 120, 60},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// household carries half of the costs
			dto := ContractDto{Costs: ptr(100.0), BillingPeriod: "monthly", Kind: EntryKindExpense, HouseholdShare: 0.5}
			ApplyAmounts(&dto, tt.amounts)
			if *dto.BaseCosts != 100 {
				t.Errorf("base costs = %v, want 100", *dto.BaseCosts)
			}
			if *dto.Costs != tt.wantCosts {
				t.Errorf("costs = %v, want %v", *dto.Costs, tt.wantCosts)
			}
			if *dto.MonthlyCosts != tt.wantMonthly {
				t.Errorf("monthly costs = %v, want %v", *dto.MonthlyCosts, tt.wantMonthly)
			}
			if len(dto.Amounts) != len(tt.amounts) {
				t.Errorf("amounts = %d, want %d", len(dto.Amounts), len(tt.amounts))
			}
		})
	}
}
