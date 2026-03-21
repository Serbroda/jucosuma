package dtos

import (
	"strings"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
)

func MapContractToContractDto(item sqlc.Contract) ContractDto {
	dto := ContractDto{
		ID:             item.ID,
		Name:           item.Name,
		Company:        item.Company,
		Category:       item.Category,
		StartDate:      DateOnly(item.StartDate),
		EndDate:        (*DateOnly)(item.EndDate),
		ContractNumber: item.ContractNumber,
		CustomerNumber: item.CustomerNumber,
		ContractHolder: item.ContractHolder,
		BillingPeriod:  strings.ToLower(item.BillingPeriod),
		Costs:          item.Costs,
		Currency:       item.Currency,
		ContactPerson:  item.ContactPerson,
		ContactAddress: item.ContactAddress,
		ContactPhone:   item.ContactPhone,
		ContactEmail:   item.ContactEmail,
		IconSource:     item.IconSource,
		Notes:          item.Notes,
		OwnerID:        item.OwnerID,
		SplitBetween:   item.SplitBetween,
		CreatedAt:      item.CreatedAt,
		UpdatedAt:      item.UpdatedAt,
	}

	dto.Status = computeStatus(item.EndDate)
	dto.NextBillingDate = computeNextBillingDate(item.NextBillingDate, item.StartDate, item.BillingPeriod)
	dto.MonthlyCosts = computeMonthlyCosts(item.Costs, item.BillingPeriod, item.SplitBetween)

	return dto
}

func computeStatus(endDate *time.Time) ContractStatus {
	if endDate == nil {
		return ContractStatusActive
	}
	endDay := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, time.UTC)
	if !endDay.Before(today()) {
		return ContractStatusCancelled
	}
	return ContractStatusExpired
}

// today returns the current date as a time.Time at midnight UTC, for date-only comparisons.
func today() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func computeNextBillingDate(stored *time.Time, startDate time.Time, billingPeriod string) *DateOnly {
	period := strings.ToLower(billingPeriod)
	if period == string(BillingPeriodNone) || period == string(BillingPeriodOneTime) {
		return nil
	}

	td := today()

	// If manually set and in the future, use it
	if stored != nil {
		storedDate := time.Date(stored.Year(), stored.Month(), stored.Day(), 0, 0, 0, 0, time.UTC)
		if !storedDate.Before(td) {
			d := DateOnly(storedDate)
			return &d
		}
	}

	// Calculate from start_date + billing_period
	// Normalize start_date to UTC midnight
	next := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	for next.Before(td) {
		next = addBillingPeriod(next, period)
	}
	d := DateOnly(next)
	return &d
}

func addBillingPeriod(t time.Time, period string) time.Time {
	switch period {
	case string(BillingPeriodWeekly):
		return t.AddDate(0, 0, 7)
	case string(BillingPeriodMonthly):
		return t.AddDate(0, 1, 0)
	case string(BillingPeriodQuarterly):
		return t.AddDate(0, 3, 0)
	case string(BillingPeriodSemiannual):
		return t.AddDate(0, 6, 0)
	case string(BillingPeriodAnnually):
		return t.AddDate(1, 0, 0)
	case string(BillingPeriodEveryTwoYears):
		return t.AddDate(2, 0, 0)
	default:
		return t.AddDate(0, 1, 0)
	}
}

func computeMonthlyCosts(costs *float64, billingPeriod string, splitBetween int64) *float64 {
	if costs == nil || *costs == 0 {
		return nil
	}
	period := strings.ToLower(billingPeriod)
	if period == string(BillingPeriodNone) {
		return nil
	}

	var factor float64
	switch period {
	case string(BillingPeriodOneTime):
		return nil
	case string(BillingPeriodWeekly):
		factor = 52.0 / 12.0
	case string(BillingPeriodMonthly):
		factor = 1.0
	case string(BillingPeriodQuarterly):
		factor = 1.0 / 3.0
	case string(BillingPeriodSemiannual):
		factor = 1.0 / 6.0
	case string(BillingPeriodAnnually):
		factor = 1.0 / 12.0
	case string(BillingPeriodEveryTwoYears):
		factor = 1.0 / 24.0
	default:
		return nil
	}

	monthly := *costs * factor
	if splitBetween > 1 {
		monthly = monthly / float64(splitBetween)
	}
	return &monthly
}

func MapDocumentToDocumentDto(item sqlc.Document) DocumentDto {
	return DocumentDto{
		ID:         item.ID,
		ContractID: item.ContractID,
		Path:       item.Path,
		Title:      item.Title,
		CreatedAt:  item.CreatedAt,
		UpdatedAt:  item.UpdatedAt,
	}
}

func MapDocumentsToDocumentDtos(items []sqlc.Document) []DocumentDto {
	return utils.MapSlice(items, MapDocumentToDocumentDto)
}

func MapContractHolderToContractHolderDto(item *string) ContractHolderDto {
	return ContractHolderDto{
		Name: *item,
	}
}

func MapCategoryToCategoryDto(c sqlc.Category) CategoryDto {
	return CategoryDto{
		ID:        c.ID,
		Name:      c.Name,
		SortOrder: c.SortOrder,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}

func MapUserToUserDto(u sqlc.User) UserDto {
	return UserDto{
		ID:                 u.ID,
		Username:           u.Username,
		Role:               u.Role,
		MustChangePassword: u.MustChangePassword == 1,
		CreatedAt:          u.CreatedAt,
		UpdatedAt:          u.UpdatedAt,
	}
}
