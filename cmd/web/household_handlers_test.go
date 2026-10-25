package main

import "testing"

func ptr[T any](v T) *T { return &v }

func TestBillingInterval(t *testing.T) {
	tests := []struct {
		name       string
		period     string
		count      *int64
		unit       *string
		wantPeriod string
		wantCustom bool
		wantErr    bool
	}{
		{"preset stays", "quarterly", nil, nil, "QUARTERLY", false, false},
		{"custom weeks", "custom", ptr(int64(6)), ptr("weeks"), "MONTHLY", true, false},
		{"custom equal to preset", "custom", ptr(int64(3)), ptr("months"), "QUARTERLY", false, false},
		{"custom one week", "custom", ptr(int64(1)), ptr("weeks"), "WEEKLY", false, false},
		{"missing count", "custom", nil, ptr("days"), "", false, true},
		{"invalid unit", "custom", ptr(int64(2)), ptr("hours"), "", false, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			period, count, unit, err := billingInterval(tt.period, tt.count, tt.unit)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v", err)
			}
			if period != tt.wantPeriod || (count != nil) != tt.wantCustom || (unit != nil) != tt.wantCustom {
				t.Errorf("got %q %v %v", period, count, unit)
			}
		})
	}
}
