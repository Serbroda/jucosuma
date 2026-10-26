package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

// errExchangeTooNew tells that a file was exported by a newer Jucosuma with an unknown format.
var errExchangeTooNew = errors.New("the file was exported by a newer version of Jucosuma, please update first")

// parseExchange reads an exported file of any known format version and converts it to the
// current one, step by step like database migrations.
func (app *application) parseExchange(ctx context.Context, body []byte) (*exchangeFile, error) {
	body = bytes.TrimSpace(body)
	if len(body) > 0 && body[0] == '[' {
		var entries []dtos.CreateContractDto
		if err := json.Unmarshal(body, &entries); err != nil {
			return nil, fmt.Errorf("invalid JSON: %w", err)
		}
		return app.convertExchangeV1(ctx, entries)
	}

	var header struct {
		Format        string `json:"format"`
		FormatVersion int    `json:"format_version"`
	}
	if err := json.Unmarshal(body, &header); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if header.Format != exchangeFormat {
		return nil, errors.New("not a Jucosuma export")
	}
	if header.FormatVersion > exchangeFormatVersion {
		return nil, errExchangeTooNew
	}
	// format_version 2 is the current one; converters for later versions go here (v2 → v3, …)
	var file exchangeFile
	if err := json.Unmarshal(body, &file); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return &file, nil
}

// convertExchangeV1 converts a version 1 export (a plain array of entries). Its ids refer to the
// installation it was exported from, so it only ever made sense there: the persons, accounts, …
// of this installation are added, and the import then finds them by name again.
func (app *application) convertExchangeV1(ctx context.Context, entries []dtos.CreateContractDto) (*exchangeFile, error) {
	file, err := app.exchangeMasterData(ctx)
	if err != nil {
		return nil, err
	}
	file.FormatVersion = 1
	file.AppVersion = ""
	for _, p := range entries {
		entry := exchangeEntry{
			Name: p.Name, Kind: string(p.Kind), CategoryID: p.CategoryID, Category: p.Category,
			AccountID: p.AccountID, TargetAccountID: p.TargetAccountID, GoalID: p.GoalID, ContactID: p.ContactID,
			TransferType: p.TransferType, Private: p.OwnerID != nil, IsContract: p.IsContract, IsVariable: p.Variable(),
			StartDate: p.StartDate, EndDate: p.EndDate, BillingPeriod: p.BillingPeriod,
			IntervalCount: p.IntervalCount, IntervalUnit: p.IntervalUnit, Costs: importBaseCosts(p), Currency: p.Currency,
			NextBillingDate: p.NextBillingDate, TermMonths: p.TermMonths, NoticePeriod: p.NoticePeriod, NoticeUnit: p.NoticeUnit,
			Company: p.Company, ContractNumber: p.ContractNumber, CustomerNumber: p.CustomerNumber, ContractHolder: p.ContractHolder,
			ContactPerson: p.ContactPerson, ContactAddress: p.ContactAddress, ContactPhone: p.ContactPhone,
			ContactEmail: p.ContactEmail, Website: p.Website, IconSource: p.IconSource, Notes: p.Notes,
			SplitBetween: p.SplitBetween, Shares: p.Shares,
		}
		for _, a := range p.Amounts {
			entry.Amounts = append(entry.Amounts, exchangeAmount{ValidFrom: a.ValidFrom, Costs: a.Costs})
		}
		if p.Links != nil {
			entry.Links = *p.Links
		}
		file.Entries = append(file.Entries, entry)
	}
	return file, nil
}

// exchangeResult tells what an import did (or, as preview, would do).
type exchangeResult struct {
	FormatVersion   int            `json:"format_version"`
	AppVersion      string         `json:"app_version"`
	Created         map[string]int `json:"created"`
	Reused          map[string]int `json:"reused"`
	Imported        int            `json:"imported"`
	Closings        int            `json:"closings"`
	SkippedClosings int            `json:"skipped_closings"`
	Errors          int            `json:"errors"`
	Rows            []exchangeRow  `json:"rows"`
}

type exchangeRow struct {
	Name        string  `json:"name"`
	Company     string  `json:"company"`
	Category    string  `json:"category"`
	CategoryKey *string `json:"category_key"`
	StartDate   string  `json:"start_date"`
}

// idMap maps the ids of a file to the ids of this installation.
type idMap map[int64]int64

func (m idMap) of(id *int64) *int64 {
	if id == nil {
		return nil
	}
	if mapped, ok := m[*id]; ok {
		return &mapped
	}
	return nil
}

func nameKey(name string) string { return strings.ToLower(strings.TrimSpace(name)) }

func boolToInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func timeOf(d *dtos.DateOnly) *time.Time { return (*time.Time)(d) }

// importExchange adds a household export: persons, accounts, categories, goals and contacts are
// matched by name (categories by key first) and created when missing; entries are always added,
// month closings only for months without a closing.
func (app *application) importExchange(ctx context.Context, q *sqlc.Queries, user sqlc.User, file *exchangeFile) (*exchangeResult, error) {
	result := &exchangeResult{
		FormatVersion: file.FormatVersion, AppVersion: file.AppVersion,
		Created: map[string]int{}, Reused: map[string]int{}, Rows: []exchangeRow{},
	}
	count := func(kind string, reused bool) {
		if reused {
			result.Reused[kind]++
		} else {
			result.Created[kind]++
		}
	}

	persons, accounts, categories, goals, contacts := idMap{}, idMap{}, idMap{}, idMap{}, idMap{}

	existingPersons, err := q.FindAllPersons(ctx)
	if err != nil {
		return nil, err
	}
	personByName := map[string]int64{}
	for _, p := range existingPersons {
		personByName[nameKey(p.Name)] = p.ID
	}
	for _, p := range file.Persons {
		if id, ok := personByName[nameKey(p.Name)]; ok {
			persons[p.ID] = id
			count("persons", true)
			continue
		}
		created, err := q.InsertPerson(ctx, sqlc.InsertPersonParams{Name: p.Name, InHousehold: boolToInt(p.InHousehold), SortOrder: p.SortOrder})
		if err != nil {
			return nil, fmt.Errorf("person '%s': %w", p.Name, err)
		}
		persons[p.ID], personByName[nameKey(p.Name)] = created.ID, created.ID
		count("persons", false)
	}

	existingAccounts, err := q.FindAllAccounts(ctx)
	if err != nil {
		return nil, err
	}
	accountByName := map[string]int64{}
	for _, a := range existingAccounts {
		accountByName[nameKey(a.Name)] = a.ID
	}
	for _, a := range file.Accounts {
		if id, ok := accountByName[nameKey(a.Name)]; ok {
			accounts[a.ID] = id
			count("accounts", true)
			continue
		}
		created, err := q.InsertAccount(ctx, sqlc.InsertAccountParams{
			Name: a.Name, Type: strings.ToUpper(a.Type), PersonID: persons.of(a.PersonID), SortOrder: a.SortOrder,
			IsSavings: boolToInt(a.IsSavings), Iban: a.Iban, Balance: a.Balance, BalanceDate: timeOf(a.BalanceDate),
			GoalAmount: a.GoalAmount, GoalDate: timeOf(a.GoalDate), Icon: a.Icon, Color: a.Color,
		})
		if err != nil {
			return nil, fmt.Errorf("account '%s': %w", a.Name, err)
		}
		accounts[a.ID], accountByName[nameKey(a.Name)] = created.ID, created.ID
		count("accounts", false)
	}

	existingCategories, err := q.FindAllCategories(ctx)
	if err != nil {
		return nil, err
	}
	categoryByName, categoryByKey := map[string]int64{}, map[string]int64{}
	for _, c := range existingCategories {
		categoryByName[nameKey(c.Name)] = c.ID
		if c.Key != nil {
			categoryByKey[*c.Key] = c.ID
		}
	}
	for _, c := range file.Categories {
		id, ok := int64(0), false
		if c.Key != nil {
			id, ok = categoryByKey[*c.Key]
		}
		if !ok {
			id, ok = categoryByName[nameKey(c.Name)]
		}
		if ok {
			categories[c.ID] = id
			count("categories", true)
			continue
		}
		created, err := insertCategoryUnique(ctx, q, sqlc.InsertCategoryParams{
			Name: c.Name, SortOrder: c.SortOrder, Type: strings.ToUpper(c.Type), Color: c.Color, Icon: c.Icon,
		})
		if err != nil {
			return nil, fmt.Errorf("category '%s': %w", c.Name, err)
		}
		categories[c.ID], categoryByName[nameKey(c.Name)] = created.ID, created.ID
		count("categories", false)
	}

	existingGoals, err := q.FindAllSavingsGoals(ctx)
	if err != nil {
		return nil, err
	}
	goalByName := map[string]int64{}
	for _, g := range existingGoals {
		goalByName[nameKey(g.Name)] = g.ID
	}
	for _, g := range file.Goals {
		if id, ok := goalByName[nameKey(g.Name)]; ok {
			goals[g.ID] = id
			count("goals", true)
			continue
		}
		created, err := q.InsertSavingsGoal(ctx, sqlc.InsertSavingsGoalParams{
			Name: g.Name, Kind: strings.ToUpper(g.Kind), Icon: g.Icon, Color: g.Color,
			PersonID: persons.of(g.PersonID), AccountID: accounts.of(g.AccountID),
			TargetAmount: g.TargetAmount, TargetDate: timeOf(g.TargetDate),
			CurrentAmount: g.CurrentAmount, CurrentDate: timeOf(g.CurrentDate), SortOrder: g.SortOrder,
		})
		if err != nil {
			return nil, fmt.Errorf("goal '%s': %w", g.Name, err)
		}
		goals[g.ID], goalByName[nameKey(g.Name)] = created.ID, created.ID
		count("goals", false)
	}

	existingContacts, err := q.FindAllContacts(ctx)
	if err != nil {
		return nil, err
	}
	contactByName := map[string]int64{}
	contactNames := map[int64]string{}
	for _, k := range existingContacts {
		contactByName[nameKey(k.Name)] = k.ID
		contactNames[k.ID] = k.Name
	}
	for _, k := range file.Contacts {
		if id, ok := contactByName[nameKey(k.Name)]; ok {
			contacts[k.ID] = id
			count("contacts", true)
			continue
		}
		created, err := q.InsertContact(ctx, sqlc.InsertContactParams{
			Name: k.Name, IconSource: k.IconSource, ContactPerson: k.ContactPerson, Address: k.Address,
			Phone: k.Phone, Email: k.Email, Website: k.Website, Notes: k.Notes,
		})
		if err != nil {
			return nil, fmt.Errorf("contact '%s': %w", k.Name, err)
		}
		contacts[k.ID], contactByName[nameKey(k.Name)], contactNames[created.ID] = created.ID, created.ID, created.Name
		count("contacts", false)
	}

	if err := app.importEntries(ctx, q, user, file, result, persons, accounts, categories, goals, contacts, contactNames); err != nil {
		return nil, err
	}

	for _, mc := range file.Closings {
		if _, err := q.FindMonthClosingByMonth(ctx, mc.Month); err == nil {
			result.SkippedClosings++
			continue
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		closing, err := q.InsertMonthClosing(ctx, sqlc.InsertMonthClosingParams{Month: mc.Month, Notes: mc.Notes, CreatedBy: &user.ID})
		if err != nil {
			return nil, fmt.Errorf("closing %s: %w", mc.Month, err)
		}
		for _, a := range mc.Actuals {
			if id := categories.of(&a.CategoryID); id != nil {
				if err := q.InsertMonthClosingActual(ctx, sqlc.InsertMonthClosingActualParams{ClosingID: closing.ID, CategoryID: *id, Amount: a.Amount}); err != nil {
					return nil, fmt.Errorf("closing %s: %w", mc.Month, err)
				}
			}
		}
		for _, b := range mc.Balances {
			if id := accounts.of(&b.AccountID); id != nil {
				if err := q.InsertMonthClosingBalance(ctx, sqlc.InsertMonthClosingBalanceParams{ClosingID: closing.ID, AccountID: *id, Balance: b.Balance}); err != nil {
					return nil, fmt.Errorf("closing %s: %w", mc.Month, err)
				}
			}
		}
		result.Closings++
	}
	return result, nil
}

// insertCategoryUnique inserts a category; names stay reserved by deleted categories, so a taken
// name gets a number ("Pets (2)").
func insertCategoryUnique(ctx context.Context, q *sqlc.Queries, params sqlc.InsertCategoryParams) (sqlc.Category, error) {
	name := params.Name
	for i := 2; ; i++ {
		created, err := q.InsertCategory(ctx, params)
		if err == nil || !strings.Contains(err.Error(), "UNIQUE") || i > 20 {
			return created, err
		}
		params.Name = fmt.Sprintf("%s (%d)", name, i)
	}
}

func (app *application) importEntries(ctx context.Context, q *sqlc.Queries, user sqlc.User, file *exchangeFile, result *exchangeResult,
	persons, accounts, categories, goals, contacts idMap, contactNames map[int64]string) error {
	categoryIdx, err := app.loadCategories(ctx, q)
	if err != nil {
		return err
	}
	personsByID := map[int64]sqlc.Person{}
	all, err := q.FindAllPersons(ctx)
	if err != nil {
		return err
	}
	for _, p := range all {
		personsByID[p.ID] = p
	}

	for _, e := range file.Entries {
		entryKind := dtos.EntryKind(strings.ToLower(e.Kind))
		kind := normalizeKind(entryKind)
		categoryID, categoryName := categoryIdx.categoryParams(categories.of(e.CategoryID), e.Category, kind)
		period := e.BillingPeriod
		if period == "" {
			period = string(dtos.BillingPeriodNone)
		}
		billingPeriod, intervalCount, intervalUnit, err := billingInterval(period, e.IntervalCount, e.IntervalUnit)
		if err != nil {
			return fmt.Errorf("'%s': %w", e.Name, err)
		}
		website, err := normalizeOptionalURL(e.Website)
		if err != nil {
			return fmt.Errorf("'%s': %w", e.Name, err)
		}
		targetAccountID, goalID := accounts.of(e.TargetAccountID), goals.of(e.GoalID)
		if entryKind != dtos.EntryKindTransfer {
			targetAccountID, goalID = nil, nil
		}
		contactID, company := contacts.of(e.ContactID), e.Company
		if contactID != nil {
			name := contactNames[*contactID]
			company = &name
		}
		var ownerID *int64
		if e.Private {
			ownerID = &user.ID
		}
		isExpense := kind == "EXPENSE"

		inserted, err := q.InsertContract(ctx, sqlc.InsertContractParams{
			Name: e.Name, Company: company, ContactID: contactID, Category: categoryName, CategoryID: categoryID,
			IsContract: boolToInt64(e.IsContract && isExpense),
			IsVariable: boolToInt64(e.IsVariable && !e.IsContract && isExpense),
			TermMonths: e.TermMonths, NoticePeriod: e.NoticePeriod, NoticeUnit: noticeUnit(e.NoticePeriod, e.NoticeUnit),
			StartDate: time.Time(e.StartDate), EndDate: timeOf(e.EndDate),
			ContractNumber: e.ContractNumber, CustomerNumber: e.CustomerNumber, ContractHolder: e.ContractHolder,
			BillingPeriod: billingPeriod, IntervalCount: intervalCount, IntervalUnit: intervalUnit,
			Costs: e.Costs, Currency: e.Currency, NextBillingDate: timeOf(e.NextBillingDate),
			ContactPerson: e.ContactPerson, ContactAddress: e.ContactAddress, ContactPhone: e.ContactPhone,
			ContactEmail: e.ContactEmail, Website: website, IconSource: e.IconSource, Notes: e.Notes,
			OwnerID: ownerID, SplitBetween: maxInt64(e.SplitBetween, 1), Kind: kind,
			AccountID: accounts.of(e.AccountID), TargetAccountID: targetAccountID, GoalID: goalID,
			TransferType: transferType(entryKind, e.TransferType),
		})
		if err != nil {
			return fmt.Errorf("'%s': %w", e.Name, err)
		}

		var shares []dtos.ShareDto
		if entryKind != dtos.EntryKindTransfer {
			for _, s := range e.Shares {
				if id := persons.of(&s.PersonID); id != nil {
					shares = append(shares, dtos.ShareDto{PersonID: *id, Weight: s.Weight, Amount: s.Amount})
				}
			}
		}
		if err := replaceContractShares(ctx, q, inserted.ID, shares, personsByID); err != nil {
			return fmt.Errorf("shares of '%s': %w", e.Name, err)
		}
		for _, a := range e.Amounts {
			if err := q.UpsertContractAmount(ctx, sqlc.UpsertContractAmountParams{
				ContractID: inserted.ID, ValidFrom: time.Time(a.ValidFrom), Costs: a.Costs,
			}); err != nil {
				return fmt.Errorf("amounts of '%s': %w", e.Name, err)
			}
		}
		if len(e.Links) > 0 {
			if err := replaceContractLinks(ctx, q, inserted.ID, e.Links); err != nil {
				return fmt.Errorf("'%s': %w", e.Name, err)
			}
		}

		row := exchangeRow{Name: e.Name, Category: categoryName, StartDate: time.Time(e.StartDate).Format("2006-01-02")}
		if c := categoryIdx.resolve(categoryID, categoryName, kind); c != nil {
			row.CategoryKey = c.Key
		}
		if company != nil {
			row.Company = *company
		}
		result.Rows = append(result.Rows, row)
		result.Imported++
	}
	return nil
}
