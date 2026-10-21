package dtos

import (
	"math"
	"testing"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

func ptr[T any](v T) *T { return &v }

func TestMapContractWithShares(t *testing.T) {
	persons := map[int64]sqlc.Person{
		1: {ID: 1, Name: "Danny", InHousehold: 1},
		2: {ID: 2, Name: "Julia", InHousehold: 1},
		3: {ID: 3, Name: "Friends", InHousehold: 0},
	}

	tests := []struct {
		name          string
		contract      sqlc.Contract
		shares        []sqlc.ContractShare
		wantShare     float64
		wantMonthly   float64
		wantAmountNil bool
	}{
		{
			name:     "external persons carry 75 percent",
			contract: sqlc.Contract{Kind: "EXPENSE", BillingPeriod: "MONTHLY", Costs: ptr(23.99), SplitBetween: 1},
			shares: []sqlc.ContractShare{
				{PersonID: 1, Weight: 1}, {PersonID: 2, Weight: 1}, {PersonID: 3, Weight: 6},
			},
			wantShare:   0.25,
			wantMonthly: 23.99 * 0.25,
		},
		{
			name:        "legacy split_between without shares",
			contract:    sqlc.Contract{Kind: "EXPENSE", BillingPeriod: "ANNUALLY", Costs: ptr(120.0), SplitBetween: 4},
			wantShare:   0.25,
			wantMonthly: 2.5,
		},
		{
			name:        "shares of deleted persons are ignored",
			contract:    sqlc.Contract{Kind: "EXPENSE", BillingPeriod: "MONTHLY", Costs: ptr(10.0), SplitBetween: 1},
			shares:      []sqlc.ContractShare{{PersonID: 1, Weight: 1}, {PersonID: 99, Weight: 1}},
			wantShare:   1,
			wantMonthly: 10,
		},
		{
			name:        "income is never split",
			contract:    sqlc.Contract{Kind: "INCOME", BillingPeriod: "MONTHLY", Costs: ptr(3000.0), SplitBetween: 3},
			wantShare:   1,
			wantMonthly: 3000,
		},
		{
			name:          "one-time entries have no monthly amount",
			contract:      sqlc.Contract{Kind: "EXPENSE", BillingPeriod: "ONE_TIME", Costs: ptr(500.0), SplitBetween: 1},
			wantShare:     1,
			wantAmountNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := MapContractWithShares(tt.contract, tt.shares, persons)
			if math.Abs(dto.HouseholdShare-tt.wantShare) > 1e-9 {
				t.Errorf("HouseholdShare = %v, want %v", dto.HouseholdShare, tt.wantShare)
			}
			if tt.wantAmountNil {
				if dto.MonthlyCosts != nil {
					t.Errorf("MonthlyCosts = %v, want nil", *dto.MonthlyCosts)
				}
				return
			}
			if dto.MonthlyCosts == nil || math.Abs(*dto.MonthlyCosts-tt.wantMonthly) > 1e-9 {
				t.Errorf("MonthlyCosts = %v, want %v", dto.MonthlyCosts, tt.wantMonthly)
			}
		})
	}
}
