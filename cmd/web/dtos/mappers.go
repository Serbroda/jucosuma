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
		ContactID:       item.ContactID,
		Shares:          []ShareDto{},
		CreatedAt:       item.CreatedAt,
		UpdatedAt:       item.UpdatedAt,
	}

	if item.IntervalCount != nil && item.IntervalUnit != nil {
		unit := IntervalUnit(strings.ToLower(*item.IntervalUnit))
		dto.BillingPeriod = string(BillingPeriodCustom)
		dto.IntervalCount = item.IntervalCount
		dto.IntervalUnit = &unit
	}

	dto.IsContract = item.IsContract == 1
	dto.IsVariable = item.IsVariable == 1
	if item.TransferType != nil {
		transferType := TransferType(strings.ToLower(*item.TransferType))
		dto.TransferType = &transferType
	}
	dto.TermMonths = item.TermMonths
	dto.NoticePeriod = item.NoticePeriod
	if item.NoticeUnit != nil {
		unit := NoticeUnit(strings.ToLower(*item.NoticeUnit))
		dto.NoticeUnit = &unit
	}
	dto.TermEnd, dto.CancelBy = computeTerm(item.StartDate, item.EndDate, item.TermMonths, item.NoticePeriod, dto.NoticeUnit, today())

	dto.Status = computeStatus(item.EndDate)
	interval := intervalOf(dto)
	dto.NextBillingDate = computeNextBillingDate(item.NextBillingDate, item.StartDate, interval)
	dto.MonthlyAmount = computeMonthlyAmount(item.Costs, interval)
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
	// fixed amounts of a split make the household's part depend on the amount
	if dto.Kind == EntryKindExpense && dto.split.fixed() > 0 && current != nil {
		dto.HouseholdShare = dto.split.householdShare(*current)
	}
	dto.MonthlyAmount = computeMonthlyAmount(current, intervalOf(*dto))
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
	split := shareSplit{}
	for _, s := range shares {
		p, ok := persons[s.PersonID]
		if !ok {
			continue
		}
		dto.Shares = append(dto.Shares, ShareDto{PersonID: s.PersonID, Weight: s.Weight, Amount: s.Amount})
		split.add(s.Weight, s.Amount, p.InHousehold == 1)
	}
	dto.split = split

	costs := 0.0
	if dto.Costs != nil {
		costs = *dto.Costs
	}
	switch {
	case dto.Kind != EntryKindExpense:
		dto.HouseholdShare = 1
	case split.totalWeight > 0 || split.fixed() > 0:
		dto.HouseholdShare = split.householdShare(costs)
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

// shareSplit sums up the shares of an entry: fixed amounts per payment and weights of the rest,
// each in total and for household members.
type shareSplit struct {
	householdFixed, externalFixed float64
	householdWeight, totalWeight  float64
}

func (s *shareSplit) add(weight float64, amount *float64, inHousehold bool) {
	switch {
	case amount != nil && inHousehold:
		s.householdFixed += *amount
	case amount != nil:
		s.externalFixed += *amount
	default:
		s.totalWeight += weight
		if inHousehold {
			s.householdWeight += weight
		}
	}
}

func (s shareSplit) fixed() float64 { return s.householdFixed + s.externalFixed }

// householdShare is the fraction of a payment of the given amount the household carries: fixed
// amounts come first, the rest is split by weight. Without weights the rest stays with the payer,
// i.e. the household; fixed amounts above the payment are reduced proportionally.
func (s shareSplit) householdShare(costs float64) float64 {
	fixed := s.fixed()
	if fixed == 0 {
		if s.totalWeight == 0 {
			return 1
		}
		return s.householdWeight / s.totalWeight
	}
	if costs <= fixed {
		return s.householdFixed / fixed
	}
	rest := costs - fixed
	if s.totalWeight > 0 {
		rest = rest * s.householdWeight / s.totalWeight
	}
	return (s.householdFixed + rest) / costs
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

// interval is how often an entry repeats: every count days or months. A zero count means it does
// not repeat (one-time, no costs).
type interval struct {
	count int
	days  bool
}

func (i interval) recurring() bool { return i.count > 0 }

// intervalOf returns the interval of an entry, presets and custom intervals alike.
func intervalOf(dto ContractDto) interval {
	if BillingPeriod(dto.BillingPeriod) == BillingPeriodCustom {
		if dto.IntervalCount == nil || dto.IntervalUnit == nil || *dto.IntervalCount < 1 {
			return interval{}
		}
		n := int(*dto.IntervalCount)
		switch *dto.IntervalUnit {
		case IntervalUnitDays:
			return interval{count: n, days: true}
		case IntervalUnitWeeks:
			return interval{count: 7 * n, days: true}
		case IntervalUnitYears:
			return interval{count: 12 * n}
		default:
			return interval{count: n}
		}
	}
	switch BillingPeriod(strings.ToLower(dto.BillingPeriod)) {
	case BillingPeriodWeekly:
		return interval{count: 7, days: true}
	case BillingPeriodMonthly:
		return interval{count: 1}
	case BillingPeriodQuarterly:
		return interval{count: 3}
	case BillingPeriodSemiannual:
		return interval{count: 6}
	case BillingPeriodAnnually:
		return interval{count: 12}
	case BillingPeriodEveryTwoYears:
		return interval{count: 24}
	default:
		return interval{}
	}
}

func computeNextBillingDate(stored *time.Time, startDate time.Time, period interval) *DateOnly {
	if !period.recurring() {
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
		next = period.addTo(next)
	}
	d := DateOnly(next)
	return &d
}

func (i interval) addTo(t time.Time) time.Time {
	if i.days {
		return t.AddDate(0, 0, i.count)
	}
	return t.AddDate(0, i.count, 0)
}

func computeMonthlyAmount(costs *float64, period interval) *float64 {
	if costs == nil || *costs == 0 || !period.recurring() {
		return nil
	}
	// days: 52 weeks a year, so weekly stays 52/12 per month
	factor := 1.0 / float64(period.count)
	if period.days {
		factor = 52.0 * 7.0 / 12.0 / float64(period.count)
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

func MapContactToContactDto(c sqlc.Contact) ContactDto {
	return ContactDto{
		ID:            c.ID,
		Name:          c.Name,
		IconSource:    c.IconSource,
		ContactPerson: c.ContactPerson,
		Address:       c.Address,
		Phone:         c.Phone,
		Email:         c.Email,
		Website:       c.Website,
		Notes:         c.Notes,
		CreatedAt:     c.CreatedAt,
		UpdatedAt:     c.UpdatedAt,
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
		Icon:        a.Icon,
		Color:       a.Color,
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
