package dtos

import (
	"math"
	"testing"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

func TestCustomInterval(t *testing.T) {
	tests := []struct {
		name        string
		count       int64
		unit        string
		wantMonthly float64
	}{
		{"every 6 weeks", 6, "WEEKS", 40 * 52.0 / 12.0 / 6},
		{"every 10 days", 10, "DAYS", 40 * 52.0 * 7.0 / 12.0 / 10},
		{"every 2 months", 2, "MONTHS", 20},
		{"every 3 years", 3, "YEARS", 40.0 / 36},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dto := MapContractToContractDto(sqlc.Contract{
				Kind: "EXPENSE", BillingPeriod: "MONTHLY", Costs: ptr(40.0), SplitBetween: 1,
				StartDate: time.Now().AddDate(-1, 0, 0), IntervalCount: ptr(tt.count), IntervalUnit: ptr(tt.unit),
			})
			if dto.BillingPeriod != string(BillingPeriodCustom) || *dto.IntervalCount != tt.count {
				t.Fatalf("got period %q", dto.BillingPeriod)
			}
			if dto.MonthlyAmount == nil || math.Abs(*dto.MonthlyAmount-tt.wantMonthly) > 1e-9 {
				t.Errorf("monthly = %v, want %v", dto.MonthlyAmount, tt.wantMonthly)
			}
			if dto.NextBillingDate == nil || time.Time(*dto.NextBillingDate).Before(today()) {
				t.Errorf("next billing date %v not from today on", dto.NextBillingDate)
			}
		})
	}
}

func TestCustomIntervalNextBillingDate(t *testing.T) {
	start := today().AddDate(0, 0, -50)
	dto := MapContractToContractDto(sqlc.Contract{
		Kind: "EXPENSE", BillingPeriod: "MONTHLY", Costs: ptr(40.0), SplitBetween: 1,
		StartDate: start, IntervalCount: ptr(int64(6)), IntervalUnit: ptr("WEEKS"),
	})
	if want := start.AddDate(0, 0, 84); !time.Time(*dto.NextBillingDate).Equal(want) {
		t.Errorf("next = %v, want %v", time.Time(*dto.NextBillingDate), want)
	}
}
