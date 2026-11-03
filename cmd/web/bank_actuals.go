package main

import (
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

// getBankActuals returns the household totals of a month's bookings per category (by user and linked
// entry), the unassigned spending and how far imports cover each account.
func (app *application) getBankActuals(c echo.Context) error {
	month := c.QueryParam("month")
	if !monthPattern.MatchString(month) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month, expected YYYY-MM")
	}
	from, _ := time.Parse("2006-01", month)
	to := from.AddDate(0, 1, 0)
	ctx := c.Request().Context()

	rows, err := app.queries.SumHouseholdBankTransactions(ctx, sqlc.SumHouseholdBankTransactionsParams{DateFrom: from, DateTo: to})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	names, err := app.userNames(c)
	if err != nil {
		return err
	}

	result := dtos.BankActualsDto{Month: month, Categories: []dtos.BankCategoryActualDto{}}
	byCategory := map[int64]*dtos.BankCategoryActualDto{}
	for _, r := range rows {
		spent := -r.Total
		if r.CategoryID == nil {
			if r.Total < 0 {
				result.Unassigned.Amount += spent
				result.Unassigned.Bookings += r.Bookings
			}
			continue
		}
		cat := byCategory[*r.CategoryID]
		if cat == nil {
			cat = &dtos.BankCategoryActualDto{CategoryID: *r.CategoryID, ByUser: []dtos.BankUserActualDto{}, Entries: []dtos.BankEntryActualDto{}}
			byCategory[*r.CategoryID] = cat
		}
		cat.Amount += spent
		cat.Bookings += r.Bookings
		addUser(cat, r.OwnerID, names[r.OwnerID], spent, r.Bookings)
		if r.ContractID != nil {
			addEntry(cat, *r.ContractID, spent, r.Bookings)
		}
	}
	for _, cat := range byCategory {
		cat.Amount = roundCents(cat.Amount)
		for i := range cat.ByUser {
			cat.ByUser[i].Amount = roundCents(cat.ByUser[i].Amount)
		}
		for i := range cat.Entries {
			cat.Entries[i].Amount = roundCents(cat.Entries[i].Amount)
		}
		result.Categories = append(result.Categories, *cat)
	}
	result.Unassigned.Amount = roundCents(result.Unassigned.Amount)
	sort.Slice(result.Categories, func(i, j int) bool { return result.Categories[i].CategoryID < result.Categories[j].CategoryID })

	periods, err := app.queries.FindBankImportPeriods(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	result.Coverage = coverage(periods, from, to.AddDate(0, 0, -1))

	last, err := app.queries.FindLastBankBalances(ctx, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	result.Balances = []dtos.BankBalanceDto{}
	for _, b := range endBalances(last) {
		for _, cov := range result.Coverage {
			if cov.AccountID == b.AccountID && cov.Complete {
				result.Balances = append(result.Balances, b)
			}
		}
	}
	return c.JSON(http.StatusOK, result)
}

// endBalances picks per account the balance after the last booking of its last booking day. Exports
// sort bookings of a day differently, so the last one is the booking no other booking of that day
// builds on (its balance is no other's balance before).
func endBalances(rows []sqlc.FindLastBankBalancesRow) []dtos.BankBalanceDto {
	byAccount := map[int64][]sqlc.FindLastBankBalancesRow{}
	for _, r := range rows {
		byAccount[*r.AccountID] = append(byAccount[*r.AccountID], r)
	}
	cents := func(v float64) int64 { return int64(math.Round(v * 100)) }
	result := []dtos.BankBalanceDto{}
	for accountID, day := range byAccount {
		before := map[int64]bool{}
		for _, r := range day {
			before[cents(*r.BalanceAfter-r.Amount)] = true
		}
		for _, r := range day {
			if !before[cents(*r.BalanceAfter)] {
				result = append(result, dtos.BankBalanceDto{AccountID: accountID, Balance: *r.BalanceAfter, Date: dtos.DateOnly(r.BookingDate)})
				break
			}
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].AccountID < result[j].AccountID })
	return result
}

func roundCents(v float64) float64 {
	return math.Round(v*100) / 100
}

func addUser(cat *dtos.BankCategoryActualDto, userID int64, name string, amount float64, bookings int64) {
	for i := range cat.ByUser {
		if cat.ByUser[i].UserID == userID {
			cat.ByUser[i].Amount += amount
			cat.ByUser[i].Bookings += bookings
			return
		}
	}
	cat.ByUser = append(cat.ByUser, dtos.BankUserActualDto{UserID: userID, Name: name, Amount: amount, Bookings: bookings})
}

func addEntry(cat *dtos.BankCategoryActualDto, contractID int64, amount float64, bookings int64) {
	for i := range cat.Entries {
		if cat.Entries[i].ContractID == contractID {
			cat.Entries[i].Amount += amount
			cat.Entries[i].Bookings += bookings
			return
		}
	}
	cat.Entries = append(cat.Entries, dtos.BankEntryActualDto{ContractID: contractID, Amount: amount, Bookings: bookings})
}

// userNames maps logins to the name of their person, or the login name.
func (app *application) userNames(c echo.Context) (map[int64]string, error) {
	ctx := c.Request().Context()
	users, err := app.queries.FindUserOptions(ctx)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	names := map[int64]string{}
	for _, u := range users {
		names[u.ID] = u.Username
	}
	persons, err := app.queries.FindAllPersons(ctx)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	for _, p := range persons {
		if p.UserID != nil {
			names[*p.UserID] = p.Name
		}
	}
	return names, nil
}

// coverage merges the import periods per account and tells whether they cover first..last (days).
func coverage(periods []sqlc.FindBankImportPeriodsRow, first, last time.Time) []dtos.BankAccountCoverageDto {
	byAccount := map[int64][]sqlc.FindBankImportPeriodsRow{}
	for _, p := range periods {
		byAccount[p.AccountID] = append(byAccount[p.AccountID], p)
	}
	result := []dtos.BankAccountCoverageDto{}
	for accountID, list := range byAccount {
		sort.Slice(list, func(i, j int) bool { return list[i].PeriodFrom.Before(*list[j].PeriodFrom) })
		// walk from the first day of the month as far as the periods reach without a gap
		reached := first.AddDate(0, 0, -1)
		for _, p := range list {
			if p.PeriodFrom.After(reached.AddDate(0, 0, 1)) {
				break
			}
			if p.PeriodTo.After(reached) {
				reached = *p.PeriodTo
			}
		}
		dto := dtos.BankAccountCoverageDto{AccountID: accountID, Complete: !reached.Before(last)}
		if !reached.Before(first) {
			until := reached
			if until.After(last) {
				until = last
			}
			d := dtos.DateOnly(until)
			dto.CoveredUntil = &d
		}
		result = append(result, dto)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].AccountID < result[j].AccountID })
	return result
}
