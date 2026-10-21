package dtos

import (
	"math"
	"testing"
	"time"

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

func TestComputeTerm(t *testing.T) {
	date := func(s string) time.Time {
		d, _ := time.Parse("2006-01-02", s)
		return d
	}
	months, weeks := NoticeUnitMonths, NoticeUnitWeeks
	today := date("2026-10-21")

	tests := []struct {
		name         string
		start        string
		end          *time.Time
		term, notice *int64
		unit         *NoticeUnit
		wantEnd      string
		wantCancelBy string
	}{
		{name: "yearly contract, deadline still ahead", start: "2023-02-01", term: ptr[int64](12), notice: ptr[int64](3), unit: &months,
			wantEnd: "2027-02-01", wantCancelBy: "2026-11-01"},
		{name: "deadline passed, next term", start: "2023-01-01", term: ptr[int64](12), notice: ptr[int64](3), unit: &months,
			wantEnd: "2028-01-01", wantCancelBy: "2027-10-01"},
		{name: "notice in weeks", start: "2025-12-15", term: ptr[int64](12), notice: ptr[int64](6), unit: &weeks,
			wantEnd: "2026-12-15", wantCancelBy: "2026-11-03"},
		{name: "term without notice", start: "2024-05-01", term: ptr[int64](24),
			wantEnd: "2028-05-01"},
		{name: "already cancelled", start: "2023-07-01", end: ptr(date("2027-06-30")), term: ptr[int64](24), notice: ptr[int64](3), unit: &months,
			wantEnd: "2027-06-30"},
		{name: "no term", start: "2024-01-01", notice: ptr[int64](1), unit: &months},
	}

	format := func(d *DateOnly) string {
		if d == nil {
			return ""
		}
		return time.Time(*d).Format("2006-01-02")
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			end, cancelBy := computeTerm(date(tt.start), tt.end, tt.term, tt.notice, tt.unit, today)
			if format(end) != tt.wantEnd || format(cancelBy) != tt.wantCancelBy {
				t.Errorf("got end=%q cancelBy=%q, want end=%q cancelBy=%q", format(end), format(cancelBy), tt.wantEnd, tt.wantCancelBy)
			}
		})
	}
}
