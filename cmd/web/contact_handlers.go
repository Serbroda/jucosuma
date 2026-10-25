package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/labstack/echo/v4"
)

func (app *application) getContacts(c echo.Context) error {
	contacts, err := app.queries.FindAllContacts(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, utils.MapSlice(contacts, dtos.MapContactToContactDto))
}

// contactParams validates a contact payload and returns its trimmed values.
func contactParams(c echo.Context) (dtos.SaveContactDto, error) {
	var payload dtos.SaveContactDto
	if err := BindAndValidate(c, &payload); err != nil {
		return payload, err
	}
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Name == "" {
		return payload, echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	website, err := normalizeOptionalURL(payload.Website)
	if err != nil {
		return payload, echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	payload.Website = website
	for _, field := range []**string{&payload.IconSource, &payload.ContactPerson, &payload.Address, &payload.Phone, &payload.Email, &payload.Notes} {
		*field = utils.TrimToNil(*field)
	}
	return payload, nil
}

func (app *application) createContact(c echo.Context) error {
	payload, err := contactParams(c)
	if err != nil {
		return err
	}
	contact, err := app.queries.InsertContact(c.Request().Context(), sqlc.InsertContactParams{
		Name:          payload.Name,
		IconSource:    payload.IconSource,
		ContactPerson: payload.ContactPerson,
		Address:       payload.Address,
		Phone:         payload.Phone,
		Email:         payload.Email,
		Website:       payload.Website,
		Notes:         payload.Notes,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create contact: "+err.Error())
	}
	return c.JSON(http.StatusCreated, dtos.MapContactToContactDto(contact))
}

func (app *application) updateContact(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	payload, err := contactParams(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	existing, err := qtx.FindContactById(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "contact not found")
	}
	if err := qtx.UpdateContactById(ctx, sqlc.UpdateContactByIdParams{
		ID:            id,
		Name:          payload.Name,
		IconSource:    payload.IconSource,
		ContactPerson: payload.ContactPerson,
		Address:       payload.Address,
		Phone:         payload.Phone,
		Email:         payload.Email,
		Website:       payload.Website,
		Notes:         payload.Notes,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update contact: "+err.Error())
	}
	// linked entries show the contact's name as their provider
	if existing.Name != payload.Name {
		if err := qtx.SyncContractCompanyName(ctx, sqlc.SyncContractCompanyNameParams{Name: &payload.Name, ContactID: &id}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to update entries: "+err.Error())
		}
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	updated, err := app.queries.FindContactById(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, dtos.MapContactToContactDto(updated))
}

// deleteContact removes a contact; its entries keep the contact data as their own.
func (app *application) deleteContact(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()
	qtx := app.queries.WithTx(tx)

	existing, err := qtx.FindContactById(ctx, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "contact not found")
	}
	if err := qtx.DetachContact(ctx, sqlc.DetachContactParams{
		ContactPerson: existing.ContactPerson,
		Address:       existing.Address,
		Phone:         existing.Phone,
		Email:         existing.Email,
		Website:       existing.Website,
		ContactID:     &id,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := qtx.DeleteContactSoft(ctx, id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// entryContact resolves the contact an entry links to; an unknown contact is not linked.
// With a contact, the entry's provider name is the contact's name.
func entryContact(ctx echo.Context, q *sqlc.Queries, id *int64, company *string) (*int64, *string) {
	if id == nil {
		return nil, company
	}
	contact, err := q.FindContactById(ctx.Request().Context(), *id)
	if err != nil {
		return nil, company
	}
	return &contact.ID, &contact.Name
}

// withContactData fills empty contact fields of exported entries from their linked contact, so an
// export carries the contact data even though the import does not know the contacts.
func (app *application) withContactData(ctx context.Context, entries []dtos.ContractDto) error {
	contacts, err := app.queries.FindAllContacts(ctx)
	if err != nil {
		return err
	}
	byID := make(map[int64]sqlc.Contact, len(contacts))
	for _, contact := range contacts {
		byID[contact.ID] = contact
	}
	fill := func(target **string, value *string) {
		if *target == nil || strings.TrimSpace(**target) == "" {
			*target = value
		}
	}
	for i := range entries {
		e := &entries[i]
		if e.ContactID == nil {
			continue
		}
		contact, ok := byID[*e.ContactID]
		if !ok {
			continue
		}
		fill(&e.ContactPerson, contact.ContactPerson)
		fill(&e.ContactAddress, contact.Address)
		fill(&e.ContactPhone, contact.Phone)
		fill(&e.ContactEmail, contact.Email)
		fill(&e.Website, contact.Website)
		e.ContactID = nil
	}
	return nil
}
