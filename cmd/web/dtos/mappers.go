package dtos

import (
	"strings"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
)

func MapContractToContractDto(item sqlc.Contract) ContractDto {
	dto := ContractDto{
		ID:              item.ID,
		Name:            item.Name,
		Company:         item.Company,
		Category:        item.Category,
		StartDate:       DateOnly(item.StartDate),
		EndDate:         (*DateOnly)(item.EndDate),
		ContractNumber:  item.ContractNumber,
		CustomerNumber:  item.CustomerNumber,
		ContractHolder:  item.ContractHolder,
		BillingPeriod:   strings.ToLower(item.BillingPeriod),
		Costs:           item.Costs,
		Currency:        item.Currency,
		ContactPerson:   item.ContactPerson,
		ContactAddress:  item.ContactAddress,
		ContactPhone:    item.ContactPhone,
		ContactEmail:    item.ContactEmail,
		Website:         item.Website,
		Links:           []ContractLinkDto{},
		IconSource:      item.IconSource,
		Notes:           item.Notes,
		OwnerID:         item.OwnerID,
		SplitBetween:    item.SplitBetween,
		Kind:            EntryKind(strings.ToLower(item.Kind)),
		AccountID:       item.AccountID,
		TargetAccountID: item.TargetAccountID,
		GoalID:          item.GoalID,
		Shares:          []ShareDto{},
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}

	dto.IsContract = item.IsContract == 1
	dto.TermMonths = item.TermMonths
	dto.NoticePeriod = item.NoticePeriod
	if item.NoticeUnit != nil {
		unit := NoticeUnit(strings.ToLower(*item.NoticeUnit))
		dto.NoticeUnit = &unit
	}
	dto.TermEnd, dto.CancelBy = computeTerm(item.StartDate, item.EndDate, item.TermMonths, item.NoticePeriod, dto.NoticeUnit, today())

	dto.Status = computeStatus(item.EndDate)
	dto.NextBillingDate = computeNextBillingDate(item.NextBillingDate, item.StartDate, item.BillingPeriod)
	dto.MonthlyAmount = computeMonthlyAmount(item.Costs, item.BillingPeriod)
	applyHouseholdShare(&dto, nil, nil)

	return dto
}

// MapContractWithShares maps a contract including its cost shares. persons must contain all
// non-deleted persons; shares of unknown (deleted) persons are ignored.
func MapContractWithShares(item sqlc.Contract, shares []sqlc.ContractShare, persons map[int64]sqlc.Person) ContractDto {
	dto := MapContractToContractDto(item)
	applyHouseholdShare(&dto, shares, persons)
	return dto
}

// ApplyAmounts adds the amount history of an entry. costs and the monthly amounts of the DTO
// then refer to the amount valid today; base_costs keeps the amount from the start date.
// amounts must be sorted by valid_from.
func ApplyAmounts(dto *ContractDto, amounts []sqlc.ContractAmount) {
	dto.BaseCosts = dto.Costs
	dto.Amounts = []ContractAmountDto{}
	current := dto.Costs
	for _, a := range amounts {
		dto.Amounts = append(dto.Amounts, ContractAmountDto{ID: a.ID, ValidFrom: DateOnly(a.ValidFrom), Costs: a.Costs})
		if !a.ValidFrom.After(today()) {
			costs := a.Costs
			current = &costs
		}
	}
	dto.Costs = current
	dto.MonthlyAmount = computeMonthlyAmount(current, strings.ToUpper(dto.BillingPeriod))
	dto.MonthlyCosts = nil
	if dto.MonthlyAmount != nil {
		monthly := *dto.MonthlyAmount * dto.HouseholdShare
		dto.MonthlyCosts = &monthly
	}
}

// applyHouseholdShare computes which fraction of an expense is borne by the household
// (as opposed to external persons) and derives the household's monthly costs from it.
// Without explicit shares the legacy split_between is used.
func applyHouseholdShare(dto *ContractDto, shares []sqlc.ContractShare, persons map[int64]sqlc.Person) {
	dto.Shares = []ShareDto{}
	var total, household float64
	for _, s := range shares {
		p, ok := persons[s.PersonID]
		if !ok {
			continue
		}
		dto.Shares = append(dto.Shares, ShareDto{PersonID: s.PersonID, Weight: s.Weight})
		total += s.Weight
		if p.InHousehold == 1 {
			household += s.Weight
		}
	}

	switch {
	case dto.Kind != EntryKindExpense:
		dto.HouseholdShare = 1
	case total > 0:
		dto.HouseholdShare = household / total
	case dto.SplitBetween > 1:
		dto.HouseholdShare = 1 / float64(dto.SplitBetween)
	default:
		dto.HouseholdShare = 1
	}

	if dto.MonthlyAmount == nil {
		dto.MonthlyCosts = nil
		return
	}
	monthly := *dto.MonthlyAmount * dto.HouseholdShare
	dto.MonthlyCosts = &monthly
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

// computeTerm returns the end of the current contract term and the last day to cancel for it.
// Contracts renew automatically by termMonths. A set end date means the contract is already
// cancelled: its end is the term end and there is nothing left to cancel. Without a term only
// a notice period may be known, so no dates can be derived.
func computeTerm(start time.Time, end *time.Time, termMonths, notice *int64, unit *NoticeUnit, today time.Time) (*DateOnly, *DateOnly) {
	if end != nil {
		d := DateOnly(*end)
		return &d, nil
	}
	if termMonths == nil || *termMonths <= 0 {
		return nil, nil
	}

	periods := 1
	termEnd := func() time.Time {
		return time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, periods*int(*termMonths), 0)
	}
	for termEnd().Before(today) {
		periods++
	}

	if notice == nil || unit == nil {
		d := DateOnly(termEnd())
		return &d, nil
	}
	cancelBy := subtractNotice(termEnd(), *notice, *unit)
	// the deadline for this term has passed: the next possible end is one term later
	for cancelBy.Before(today) {
		periods++
		cancelBy = subtractNotice(termEnd(), *notice, *unit)
	}
	te, cb := DateOnly(termEnd()), DateOnly(cancelBy)
	return &te, &cb
}

func subtractNotice(t time.Time, notice int64, unit NoticeUnit) time.Time {
	switch unit {
	case NoticeUnitDays:
		return t.AddDate(0, 0, -int(notice))
	case NoticeUnitWeeks:
		return t.AddDate(0, 0, -7*int(notice))
	default:
		return t.AddDate(0, -int(notice), 0)
	}
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

func computeMonthlyAmount(costs *float64, billingPeriod string) *float64 {
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

func MapCompanyToCompanyDto(item *string) CompanyDto {
	return CompanyDto{
		Name: *item,
	}
}

func MapCategoryToCategoryDto(c sqlc.Category) CategoryDto {
	return CategoryDto{
		ID:        c.ID,
		Key:       c.Key,
		Name:      c.Name,
		Type:      EntryKind(strings.ToLower(c.Type)),
		Color:     c.Color,
		Icon:      c.Icon,
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
		Language:           u.Language,
		CreatedAt:          u.CreatedAt,
		UpdatedAt:          u.UpdatedAt,
	}
}

func MapPersonToPersonDto(p sqlc.Person) PersonDto {
	return PersonDto{
		ID:          p.ID,
		Name:        p.Name,
		InHousehold: p.InHousehold == 1,
		UserID:      p.UserID,
		SortOrder:   p.SortOrder,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}

func MapAccountToAccountDto(a sqlc.Account) AccountDto {
	return AccountDto{
		ID:          a.ID,
		Name:        a.Name,
		Type:        AccountType(strings.ToLower(a.Type)),
		PersonID:    a.PersonID,
		SortOrder:   a.SortOrder,
		IsSavings:   a.IsSavings == 1,
		Iban:        a.Iban,
		Balance:     a.Balance,
		BalanceDate: (*DateOnly)(a.BalanceDate),
		GoalAmount:  a.GoalAmount,
		GoalDate:    (*DateOnly)(a.GoalDate),
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
	}
}

func MapSavingsGoalToDto(g sqlc.SavingsGoal) SavingsGoalDto {
	return SavingsGoalDto{
		ID:            g.ID,
		Name:          g.Name,
		Kind:          GoalKind(strings.ToLower(g.Kind)),
		Icon:          g.Icon,
		Color:         g.Color,
		PersonID:      g.PersonID,
		AccountID:     g.AccountID,
		TargetAmount:  g.TargetAmount,
		TargetDate:    (*DateOnly)(g.TargetDate),
		CurrentAmount: g.CurrentAmount,
		CurrentDate:   (*DateOnly)(g.CurrentDate),
		SortOrder:     g.SortOrder,
		CreatedAt:     g.CreatedAt,
		UpdatedAt:     g.UpdatedAt,
	}
}

// MapContractLinks maps the links of an entry.
func MapContractLinks(links []sqlc.ContractLink) []ContractLinkDto {
	result := make([]ContractLinkDto, 0, len(links))
	for _, l := range links {
		result = append(result, ContractLinkDto{ID: l.ID, Title: l.Title, URL: l.Url})
	}
	return result
}
