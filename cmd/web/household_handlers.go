package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

func (app *application) getPersons(c echo.Context) error {
	persons, err := app.queries.FindAllPersons(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(persons, dtos.MapPersonToPersonDto))
}

func (app *application) createPerson(c echo.Context) error {
	var payload dtos.SavePersonDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	if err := app.ensureUserNotLinked(c.Request().Context(), payload.UserID, 0); err != nil {
		return err
	}

	person, err := app.queries.InsertPerson(c.Request().Context(), sqlc.InsertPersonParams{
		Name:        strings.TrimSpace(payload.Name),
		InHousehold: boolToInt64(payload.InHousehold),
		UserID:      payload.UserID,
		SortOrder:   payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create person: "+err.Error())
	}

	return c.JSON(http.StatusCreated, dtos.MapPersonToPersonDto(person))
}

func (app *application) updatePerson(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var payload dtos.SavePersonDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	if err := app.ensureUserNotLinked(c.Request().Context(), payload.UserID, id); err != nil {
		return err
	}

	err = app.queries.UpdatePersonById(c.Request().Context(), sqlc.UpdatePersonByIdParams{
		ID:          id,
		Name:        strings.TrimSpace(payload.Name),
		InHousehold: boolToInt64(payload.InHousehold),
		UserID:      payload.UserID,
		SortOrder:   payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update person: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (app *application) deletePerson(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	if err := app.queries.DeletePersonSoft(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete person: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

// ensureUserNotLinked rejects linking a login to a second person.
func (app *application) ensureUserNotLinked(ctx context.Context, userID *int64, personID int64) error {
	if userID == nil {
		return nil
	}
	persons, err := app.queries.FindAllPersons(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	for _, p := range persons {
		if p.ID != personID && p.UserID != nil && *p.UserID == *userID {
			return echo.NewHTTPError(http.StatusConflict, "this login is already linked to "+p.Name)
		}
	}
	return nil
}

// getUserOptions lists all logins (id and name only) so any user can link persons to them.
func (app *application) getUserOptions(c echo.Context) error {
	users, err := app.queries.FindUserOptions(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(users, func(u sqlc.FindUserOptionsRow) dtos.UserOptionDto {
		return dtos.UserOptionDto{ID: u.ID, Username: u.Username}
	}))
}

func (app *application) getAccounts(c echo.Context) error {
	accounts, err := app.queries.FindAllAccounts(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(accounts, dtos.MapAccountToAccountDto))
}

func (app *application) createAccount(c echo.Context) error {
	var payload dtos.SaveAccountDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	account, err := app.queries.InsertAccount(c.Request().Context(), sqlc.InsertAccountParams{
		Name:        strings.TrimSpace(payload.Name),
		Type:        strings.ToUpper(payload.Type),
		PersonID:    payload.PersonID,
		SortOrder:   payload.SortOrder,
		IsSavings:   boolToInt64(isSavings(payload)),
		Iban:        normalizeIban(payload.Iban),
		Balance:     payload.Balance,
		BalanceDate: (*time.Time)(payload.BalanceDate),
		GoalAmount:  payload.GoalAmount,
		GoalDate:    (*time.Time)(payload.GoalDate),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create account: "+err.Error())
	}

	return c.JSON(http.StatusCreated, dtos.MapAccountToAccountDto(account))
}

func (app *application) updateAccount(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var payload dtos.SaveAccountDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}

	err = app.queries.UpdateAccountById(c.Request().Context(), sqlc.UpdateAccountByIdParams{
		ID:          id,
		Name:        strings.TrimSpace(payload.Name),
		Type:        strings.ToUpper(payload.Type),
		PersonID:    payload.PersonID,
		SortOrder:   payload.SortOrder,
		IsSavings:   boolToInt64(isSavings(payload)),
		Iban:        normalizeIban(payload.Iban),
		Balance:     payload.Balance,
		BalanceDate: (*time.Time)(payload.BalanceDate),
		GoalAmount:  payload.GoalAmount,
		GoalDate:    (*time.Time)(payload.GoalDate),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update account: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (app *application) deleteAccount(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	if err := app.queries.DeleteAccountSoft(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete account: "+err.Error())
	}

	return c.NoContent(http.StatusOK)
}

// normalizeIban removes spaces and upper-cases an IBAN; empty input becomes nil.
func normalizeIban(iban *string) *string {
	if iban == nil {
		return nil
	}
	normalized := strings.ToUpper(strings.Join(strings.Fields(*iban), ""))
	return utils.TrimToNil(&normalized)
}

// isSavings defaults the savings flag from the account type when it is not given.
func isSavings(payload dtos.SaveAccountDto) bool {
	if payload.IsSavings != nil {
		return *payload.IsSavings
	}
	return payload.Type == string(dtos.AccountTypeSavings) || payload.Type == string(dtos.AccountTypeDepot)
}

func (app *application) getSavingsGoals(c echo.Context) error {
	goals, err := app.queries.FindAllSavingsGoals(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(goals, dtos.MapSavingsGoalToDto))
}

func (app *application) createSavingsGoal(c echo.Context) error {
	var payload dtos.SaveSavingsGoalDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	goal, err := app.queries.InsertSavingsGoal(c.Request().Context(), sqlc.InsertSavingsGoalParams{
		Name:          strings.TrimSpace(payload.Name),
		Kind:          goalKind(payload.Kind),
		Icon:          utils.TrimToNil(payload.Icon),
		Color:         payload.Color,
		PersonID:      payload.PersonID,
		AccountID:     payload.AccountID,
		TargetAmount:  payload.TargetAmount,
		TargetDate:    (*time.Time)(payload.TargetDate),
		CurrentAmount: payload.CurrentAmount,
		CurrentDate:   (*time.Time)(payload.CurrentDate),
		SortOrder:     payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create goal: "+err.Error())
	}
	return c.JSON(http.StatusCreated, dtos.MapSavingsGoalToDto(goal))
}

func (app *application) updateSavingsGoal(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	var payload dtos.SaveSavingsGoalDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	err = app.queries.UpdateSavingsGoalById(c.Request().Context(), sqlc.UpdateSavingsGoalByIdParams{
		ID:            id,
		Name:          strings.TrimSpace(payload.Name),
		Kind:          goalKind(payload.Kind),
		Icon:          utils.TrimToNil(payload.Icon),
		Color:         payload.Color,
		PersonID:      payload.PersonID,
		AccountID:     payload.AccountID,
		TargetAmount:  payload.TargetAmount,
		TargetDate:    (*time.Time)(payload.TargetDate),
		CurrentAmount: payload.CurrentAmount,
		CurrentDate:   (*time.Time)(payload.CurrentDate),
		SortOrder:     payload.SortOrder,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update goal: "+err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func (app *application) deleteSavingsGoal(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := app.queries.DeleteSavingsGoalSoft(c.Request().Context(), id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete goal: "+err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func goalKind(kind string) string {
	if kind == string(dtos.GoalKindInvesting) {
		return strings.ToUpper(kind)
	}
	return strings.ToUpper(string(dtos.GoalKindSaving))
}

// mapContracts maps contracts to DTOs including their cost shares.
func (app *application) mapContracts(ctx context.Context, contracts []sqlc.Contract) ([]dtos.ContractDto, error) {
	persons, err := app.personsById(ctx, app.queries)
	if err != nil {
		return nil, err
	}
	shares, err := app.queries.FindAllContractShares(ctx)
	if err != nil {
		return nil, err
	}
	sharesByContract := make(map[int64][]sqlc.ContractShare)
	for _, s := range shares {
		sharesByContract[s.ContractID] = append(sharesByContract[s.ContractID], s)
	}
	categories, err := app.loadCategories(ctx, app.queries)
	if err != nil {
		return nil, err
	}
	amounts, err := app.queries.FindAllContractAmounts(ctx)
	if err != nil {
		return nil, err
	}
	amountsByContract := make(map[int64][]sqlc.ContractAmount)
	for _, a := range amounts {
		amountsByContract[a.ContractID] = append(amountsByContract[a.ContractID], a)
	}

	return utils.MapSlice(contracts, func(item sqlc.Contract) dtos.ContractDto {
		dto := dtos.MapContractWithShares(item, sharesByContract[item.ID], persons)
		dtos.ApplyAmounts(&dto, amountsByContract[item.ID])
		categories.apply(&dto, item)
		return dto
	}), nil
}

func (app *application) mapContract(ctx context.Context, contract sqlc.Contract) (dtos.ContractDto, error) {
	persons, err := app.personsById(ctx, app.queries)
	if err != nil {
		return dtos.ContractDto{}, err
	}
	shares, err := app.queries.FindContractSharesByContractId(ctx, contract.ID)
	if err != nil {
		return dtos.ContractDto{}, err
	}
	categories, err := app.loadCategories(ctx, app.queries)
	if err != nil {
		return dtos.ContractDto{}, err
	}
	amounts, err := app.queries.FindContractAmountsByContractId(ctx, contract.ID)
	if err != nil {
		return dtos.ContractDto{}, err
	}
	dto := dtos.MapContractWithShares(contract, shares, persons)
	dtos.ApplyAmounts(&dto, amounts)
	categories.apply(&dto, contract)
	return dto, nil
}

// categoryIndex resolves categories by id and (legacy) name.
type categoryIndex struct {
	byID   map[int64]sqlc.Category
	byName map[string]sqlc.Category
	byKey  map[string]sqlc.Category
}

func (app *application) loadCategories(ctx context.Context, q *sqlc.Queries) (*categoryIndex, error) {
	categories, err := q.FindAllCategories(ctx)
	if err != nil {
		return nil, err
	}
	idx := &categoryIndex{byID: map[int64]sqlc.Category{}, byName: map[string]sqlc.Category{}, byKey: map[string]sqlc.Category{}}
	for _, c := range categories {
		idx.byID[c.ID] = c
		if _, exists := idx.byName[strings.ToLower(c.Name)]; !exists {
			idx.byName[strings.ToLower(c.Name)] = c
		}
		if c.Key != nil {
			idx.byKey[*c.Key] = c
		}
	}
	return idx, nil
}

// resolve finds the category for an entry: by id, else by name, else the "other" category of the
// entry kind. It returns nil when nothing matches (e.g. all categories were deleted).
func (idx *categoryIndex) resolve(id *int64, name string, kind string) *sqlc.Category {
	if id != nil {
		if c, ok := idx.byID[*id]; ok {
			return &c
		}
	}
	if c, ok := idx.byName[strings.ToLower(strings.TrimSpace(name))]; ok && name != "" {
		return &c
	}
	return idx.fallback(kind)
}

// fallback is the "other" category for the entry kind.
func (idx *categoryIndex) fallback(kind string) *sqlc.Category {
	key := "other"
	if strings.EqualFold(kind, string(dtos.EntryKindIncome)) {
		key = "other_income"
	}
	if c, ok := idx.byKey[key]; ok {
		return &c
	}
	return nil
}

// apply sets id, name and translation key of the entry's category on the DTO.
func (idx *categoryIndex) apply(dto *dtos.ContractDto, item sqlc.Contract) {
	var c *sqlc.Category
	if item.CategoryID != nil {
		if found, ok := idx.byID[*item.CategoryID]; ok {
			c = &found
		}
	} else if found, ok := idx.byName[strings.ToLower(item.Category)]; ok {
		c = &found
	}
	if c == nil {
		return
	}
	dto.CategoryID = &c.ID
	dto.Category = c.Name
	dto.CategoryKey = c.Key
}

// categoryParams resolves the category of a payload into the id and name stored on the entry.
func (idx *categoryIndex) categoryParams(id *int64, name string, kind string) (*int64, string) {
	if c := idx.resolve(id, name, kind); c != nil {
		return &c.ID, c.Name
	}
	if name == "" {
		name = "Other"
	}
	return nil, name
}

func (app *application) personsById(ctx context.Context, q *sqlc.Queries) (map[int64]sqlc.Person, error) {
	persons, err := q.FindAllPersons(ctx)
	if err != nil {
		return nil, err
	}
	result := make(map[int64]sqlc.Person, len(persons))
	for _, p := range persons {
		result[p.ID] = p
	}
	return result, nil
}

// replaceContractShares stores the given shares for a contract. Shares of unknown
// persons and non-positive weights are skipped.
func replaceContractShares(ctx context.Context, q *sqlc.Queries, contractID int64, shares []dtos.ShareDto, persons map[int64]sqlc.Person) error {
	if err := q.DeleteContractSharesByContractId(ctx, contractID); err != nil {
		return err
	}
	for _, s := range shares {
		if _, ok := persons[s.PersonID]; !ok || s.Weight <= 0 {
			continue
		}
		if err := q.InsertContractShare(ctx, sqlc.InsertContractShareParams{
			ContractID: contractID,
			PersonID:   s.PersonID,
			Weight:     s.Weight,
		}); err != nil {
			return err
		}
	}
	return nil
}

// noticeUnit converts an API notice unit to its database value; nil without a notice period.
func noticeUnit(period *int64, unit *string) *string {
	if period == nil || unit == nil || *unit == "" {
		return nil
	}
	u := strings.ToUpper(*unit)
	return &u
}

// normalizeKind converts an API entry kind to its database representation.
func normalizeKind(kind dtos.EntryKind) string {
	switch kind {
	case dtos.EntryKindIncome, dtos.EntryKindTransfer:
		return strings.ToUpper(string(kind))
	default:
		return strings.ToUpper(string(dtos.EntryKindExpense))
	}
}

func boolToInt64(b bool) int64 {
	if b {
		return 1
	}
	return 0
}
