package main

import (
	"context"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

// Exchange format of the JSON export: a whole household (persons, accounts, categories, goals,
// contacts, entries, month closings) that can be imported into another installation.
//
// format_version is raised on every incompatible change; the import converts older files step by
// step (see convertExchange). Version 1 was a plain array of entries whose ids referred to the
// installation it came from. app_version is informational only.
//
// The ids in the file are only valid within the file: entries refer to persons, accounts, … by
// these ids, the import maps them to the records it finds or creates.

const (
	exchangeFormat        = "jucosuma"
	exchangeFormatVersion = 2
)

type exchangeFile struct {
	Format        string             `json:"format"`
	FormatVersion int                `json:"format_version"`
	AppVersion    string             `json:"app_version"`
	ExportedAt    time.Time          `json:"exported_at"`
	Persons       []exchangePerson   `json:"persons"`
	Accounts      []exchangeAccount  `json:"accounts"`
	Categories    []exchangeCategory `json:"categories"`
	Goals         []exchangeGoal     `json:"goals"`
	Contacts      []exchangeContact  `json:"contacts"`
	Entries       []exchangeEntry    `json:"entries"`
	Closings      []exchangeClosing  `json:"closings"`
}

type exchangePerson struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	InHousehold bool   `json:"in_household"`
	SortOrder   int64  `json:"sort_order"`
}

type exchangeAccount struct {
	ID          int64          `json:"id"`
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	PersonID    *int64         `json:"person_id"`
	IsSavings   bool           `json:"is_savings"`
	Iban        *string        `json:"iban"`
	Balance     *float64       `json:"balance"`
	BalanceDate *dtos.DateOnly `json:"balance_date"`
	GoalAmount  *float64       `json:"goal_amount"`
	GoalDate    *dtos.DateOnly `json:"goal_date"`
	Icon        *string        `json:"icon"`
	Color       *int64         `json:"color"`
	SortOrder   int64          `json:"sort_order"`
}

type exchangeCategory struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	Key       *string `json:"key"`
	Type      string  `json:"type"`
	Icon      *string `json:"icon"`
	Color     *int64  `json:"color"`
	SortOrder int64   `json:"sort_order"`
}

type exchangeGoal struct {
	ID            int64          `json:"id"`
	Name          string         `json:"name"`
	Kind          string         `json:"kind"`
	PersonID      *int64         `json:"person_id"`
	AccountID     *int64         `json:"account_id"`
	TargetAmount  *float64       `json:"target_amount"`
	TargetDate    *dtos.DateOnly `json:"target_date"`
	CurrentAmount *float64       `json:"current_amount"`
	CurrentDate   *dtos.DateOnly `json:"current_date"`
	Icon          *string        `json:"icon"`
	Color         *int64         `json:"color"`
	SortOrder     int64          `json:"sort_order"`
}

type exchangeContact struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	IconSource    *string `json:"icon_source"`
	ContactPerson *string `json:"contact_person"`
	Address       *string `json:"address"`
	Phone         *string `json:"phone"`
	Email         *string `json:"email"`
	Website       *string `json:"website"`
	Notes         *string `json:"notes"`
}

type exchangeEntry struct {
	Name            string                 `json:"name"`
	Kind            string                 `json:"kind"`
	CategoryID      *int64                 `json:"category_id"`
	Category        string                 `json:"category"`
	AccountID       *int64                 `json:"account_id"`
	TargetAccountID *int64                 `json:"target_account_id"`
	GoalID          *int64                 `json:"goal_id"`
	ContactID       *int64                 `json:"contact_id"`
	TransferType    *string                `json:"transfer_type"`
	Private         bool                   `json:"private"`
	IsContract      bool                   `json:"is_contract"`
	IsVariable      bool                   `json:"is_variable"`
	StartDate       dtos.DateOnly          `json:"start_date"`
	EndDate         *dtos.DateOnly         `json:"end_date"`
	BillingPeriod   string                 `json:"billing_period"`
	IntervalCount   *int64                 `json:"interval_count"`
	IntervalUnit    *string                `json:"interval_unit"`
	Costs           *float64               `json:"costs"`
	Currency        *string                `json:"currency"`
	NextBillingDate *dtos.DateOnly         `json:"next_billing_date"`
	TermMonths      *int64                 `json:"term_months"`
	NoticePeriod    *int64                 `json:"notice_period"`
	NoticeUnit      *string                `json:"notice_unit"`
	Company         *string                `json:"company"`
	ContractNumber  *string                `json:"contract_number"`
	CustomerNumber  *string                `json:"customer_number"`
	ContractHolder  *string                `json:"contract_holder"`
	ContactPerson   *string                `json:"contact_person"`
	ContactAddress  *string                `json:"contact_address"`
	ContactPhone    *string                `json:"contact_phone"`
	ContactEmail    *string                `json:"contact_email"`
	Website         *string                `json:"website"`
	IconSource      *string                `json:"icon_source"`
	Notes           *string                `json:"notes"`
	SplitBetween    int64                  `json:"split_between"`
	Shares          []dtos.ShareDto        `json:"shares"`
	Amounts         []exchangeAmount       `json:"amounts"`
	Links           []dtos.ContractLinkDto `json:"links"`
}

// exchangeAmount is a change of an entry's amount from a date on (the amount history).
type exchangeAmount struct {
	ValidFrom dtos.DateOnly `json:"valid_from"`
	Costs     float64       `json:"costs"`
}

type exchangeClosing struct {
	Month    string                   `json:"month"`
	Notes    *string                  `json:"notes"`
	Actuals  []exchangeClosingActual  `json:"actuals"`
	Balances []exchangeClosingBalance `json:"balances"`
}

type exchangeClosingActual struct {
	CategoryID int64   `json:"category_id"`
	Amount     float64 `json:"amount"`
}

type exchangeClosingBalance struct {
	AccountID int64   `json:"account_id"`
	Balance   float64 `json:"balance"`
}

func lower(s string) string { return strings.ToLower(s) }

func dateOnly(t *time.Time) *dtos.DateOnly { return (*dtos.DateOnly)(t) }

// buildExchange exports everything the user can see: shared data and their own private entries.
func (app *application) buildExchange(ctx context.Context, user sqlc.User) (*exchangeFile, error) {
	file, err := app.exchangeMasterData(ctx)
	if err != nil {
		return nil, err
	}
	q := app.queries

	contracts, err := q.FindContractsForUser(ctx, &user.ID)
	if err != nil {
		return nil, err
	}
	shares, err := q.FindAllContractShares(ctx)
	if err != nil {
		return nil, err
	}
	amounts, err := q.FindAllContractAmounts(ctx)
	if err != nil {
		return nil, err
	}
	links, err := q.FindAllContractLinks(ctx)
	if err != nil {
		return nil, err
	}
	sharesOf := map[int64][]dtos.ShareDto{}
	for _, s := range shares {
		sharesOf[s.ContractID] = append(sharesOf[s.ContractID], dtos.ShareDto{PersonID: s.PersonID, Weight: s.Weight, Amount: s.Amount})
	}
	amountsOf := map[int64][]exchangeAmount{}
	for _, a := range amounts {
		amountsOf[a.ContractID] = append(amountsOf[a.ContractID], exchangeAmount{ValidFrom: dtos.DateOnly(a.ValidFrom), Costs: a.Costs})
	}
	linksOf := map[int64][]dtos.ContractLinkDto{}
	for _, l := range links {
		linksOf[l.ContractID] = append(linksOf[l.ContractID], dtos.ContractLinkDto{Title: l.Title, URL: l.Url})
	}

	for _, c := range contracts {
		entry := exchangeEntry{
			Name: c.Name, Kind: lower(c.Kind), CategoryID: c.CategoryID, Category: c.Category,
			AccountID: c.AccountID, TargetAccountID: c.TargetAccountID, GoalID: c.GoalID, ContactID: c.ContactID,
			Private: c.OwnerID != nil, IsContract: c.IsContract == 1, IsVariable: c.IsVariable == 1,
			StartDate: dtos.DateOnly(c.StartDate), EndDate: dateOnly(c.EndDate),
			BillingPeriod: lower(c.BillingPeriod), IntervalCount: c.IntervalCount,
			Costs: c.Costs, Currency: c.Currency, NextBillingDate: dateOnly(c.NextBillingDate),
			TermMonths: c.TermMonths, NoticePeriod: c.NoticePeriod,
			Company: c.Company, ContractNumber: c.ContractNumber, CustomerNumber: c.CustomerNumber,
			ContractHolder: c.ContractHolder, ContactPerson: c.ContactPerson, ContactAddress: c.ContactAddress,
			ContactPhone: c.ContactPhone, ContactEmail: c.ContactEmail, Website: c.Website,
			IconSource: c.IconSource, Notes: c.Notes, SplitBetween: c.SplitBetween,
			Shares: sharesOf[c.ID], Amounts: amountsOf[c.ID], Links: linksOf[c.ID],
		}
		if c.IntervalCount != nil && c.IntervalUnit != nil {
			entry.BillingPeriod = string(dtos.BillingPeriodCustom)
			unit := lower(*c.IntervalUnit)
			entry.IntervalUnit = &unit
		}
		if c.TransferType != nil {
			t := lower(*c.TransferType)
			entry.TransferType = &t
		}
		if c.NoticeUnit != nil {
			u := lower(*c.NoticeUnit)
			entry.NoticeUnit = &u
		}
		file.Entries = append(file.Entries, entry)
	}

	closings, err := q.FindAllMonthClosings(ctx)
	if err != nil {
		return nil, err
	}
	actuals, err := q.FindAllMonthClosingActuals(ctx)
	if err != nil {
		return nil, err
	}
	balances, err := q.FindAllMonthClosingBalances(ctx)
	if err != nil {
		return nil, err
	}
	for _, mc := range closings {
		closing := exchangeClosing{Month: mc.Month, Notes: mc.Notes, Actuals: []exchangeClosingActual{}, Balances: []exchangeClosingBalance{}}
		for _, a := range actuals {
			if a.ClosingID == mc.ID {
				closing.Actuals = append(closing.Actuals, exchangeClosingActual{CategoryID: a.CategoryID, Amount: a.Amount})
			}
		}
		for _, b := range balances {
			if b.ClosingID == mc.ID {
				closing.Balances = append(closing.Balances, exchangeClosingBalance{AccountID: b.AccountID, Balance: b.Balance})
			}
		}
		file.Closings = append(file.Closings, closing)
	}
	return file, nil
}

// exchangeMasterData is an exchange file with the household's persons, accounts, categories,
// goals and contacts, but without entries and closings.
func (app *application) exchangeMasterData(ctx context.Context) (*exchangeFile, error) {
	q := app.queries
	file := &exchangeFile{
		Format: exchangeFormat, FormatVersion: exchangeFormatVersion, AppVersion: Version, ExportedAt: time.Now().UTC(),
		Persons: []exchangePerson{}, Accounts: []exchangeAccount{}, Categories: []exchangeCategory{}, Goals: []exchangeGoal{},
		Contacts: []exchangeContact{}, Entries: []exchangeEntry{}, Closings: []exchangeClosing{},
	}

	persons, err := q.FindAllPersons(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range persons {
		file.Persons = append(file.Persons, exchangePerson{ID: p.ID, Name: p.Name, InHousehold: p.InHousehold == 1, SortOrder: p.SortOrder})
	}
	accounts, err := q.FindAllAccounts(ctx)
	if err != nil {
		return nil, err
	}
	for _, a := range accounts {
		file.Accounts = append(file.Accounts, exchangeAccount{
			ID: a.ID, Name: a.Name, Type: lower(a.Type), PersonID: a.PersonID, IsSavings: a.IsSavings == 1, Iban: a.Iban,
			Balance: a.Balance, BalanceDate: dateOnly(a.BalanceDate), GoalAmount: a.GoalAmount, GoalDate: dateOnly(a.GoalDate),
			Icon: a.Icon, Color: a.Color, SortOrder: a.SortOrder,
		})
	}
	categories, err := q.FindAllCategories(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range categories {
		file.Categories = append(file.Categories, exchangeCategory{
			ID: c.ID, Name: c.Name, Key: c.Key, Type: lower(c.Type), Icon: c.Icon, Color: c.Color, SortOrder: c.SortOrder,
		})
	}
	goals, err := q.FindAllSavingsGoals(ctx)
	if err != nil {
		return nil, err
	}
	for _, g := range goals {
		file.Goals = append(file.Goals, exchangeGoal{
			ID: g.ID, Name: g.Name, Kind: lower(g.Kind), PersonID: g.PersonID, AccountID: g.AccountID,
			TargetAmount: g.TargetAmount, TargetDate: dateOnly(g.TargetDate), CurrentAmount: g.CurrentAmount,
			CurrentDate: dateOnly(g.CurrentDate), Icon: g.Icon, Color: g.Color, SortOrder: g.SortOrder,
		})
	}
	contacts, err := q.FindAllContacts(ctx)
	if err != nil {
		return nil, err
	}
	for _, k := range contacts {
		file.Contacts = append(file.Contacts, exchangeContact{
			ID: k.ID, Name: k.Name, IconSource: k.IconSource, ContactPerson: k.ContactPerson, Address: k.Address,
			Phone: k.Phone, Email: k.Email, Website: k.Website, Notes: k.Notes,
		})
	}
	return file, nil
}
