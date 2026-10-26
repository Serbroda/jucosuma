package dtos

import (
	"math"
	"testing"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

func TestFixedShareAmounts(t *testing.T) {
	persons := map[int64]sqlc.Person{
		1: {ID: 1, Name: "Julia", InHousehold: 1},
		2: {ID: 2, Name: "Brother", InHousehold: 0},
		3: {ID: 3, Name: "Friend", InHousehold: 0},
	}
	family := sqlc.Contract{Kind: "EXPENSE", BillingPeriod: "MONTHLY", Costs: ptr(17.99), SplitBetween: 1}
	fixed := []sqlc.ContractShare{
		{PersonID: 2, Amount: ptr(10.0)}, {PersonID: 3, Amount: ptr(5.0)},
	}

	tests := []struct {
		name   string
		shares []sqlc.ContractShare
		want   float64
	}{
		{"rest by weight", append([]sqlc.ContractShare{{PersonID: 1, Weight: 100}}, fixed...), 2.99 / 17.99},
		{"rest stays with the payer without weights", fixed, 2.99 / 17.99},
		{"rest split with an external weight", append([]sqlc.ContractShare{{PersonID: 1, Weight: 50}, {PersonID: 2, Weight: 50}}, fixed[1]), 6.495 / 17.99},
		{"fixed above the amount", []sqlc.ContractShare{{PersonID: 1, Amount: ptr(10.0)}, {PersonID: 2, Amount: ptr(30.0)}}, 0.25},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := MapContractWithShares(family, tt.shares, persons)
			if math.Abs(dto.HouseholdShare-tt.want) > 1e-9 {
				t.Errorf("household share = %v, want %v", dto.HouseholdShare, tt.want)
			}
		})
	}

	t.Run("follows the current amount of the history", func(t *testing.T) {
		dto := MapContractWithShares(family, fixed, persons)
		ApplyAmounts(&dto, []sqlc.ContractAmount{{ValidFrom: time.Now().AddDate(0, -1, 0), Costs: 19.99}})
		if want := 4.99 / 19.99; math.Abs(dto.HouseholdShare-want) > 1e-9 || math.Abs(*dto.MonthlyCosts-4.99) > 1e-9 {
			t.Errorf("household share = %v, monthly = %v", dto.HouseholdShare, *dto.MonthlyCosts)
		}
	})
}
