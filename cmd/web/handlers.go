package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func (app *application) getContracts(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	contractDtos := utils.MapSlice(contracts, func(item sqlc.Contract) dtos.ContractDto {
		return dtos.MapContractToContractDto(item)
	})

	return ctx.JSON(http.StatusOK, contractDtos)
}

func (app *application) getContractById(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	contract, err := app.queries.FindContractById(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	contractDto := dtos.MapContractToContractDto(contract)
	documents, err := app.queries.FindDocumentsByContractId(ctx.Request().Context(), contract.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	contractDto.Documents = dtos.MapDocumentsToDocumentDtos(documents)

	return ctx.JSON(http.StatusOK, contractDto)
}

func (app *application) createContract(c echo.Context) error {
	contract, err := app.upsertContract(c, nil)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, dtos.MapContractToContractDto(*contract))
}

func (app *application) updateContract(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	contract, err := app.upsertContract(c, &id)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, dtos.MapContractToContractDto(*contract))
}

// upsertContract übernimmt sowohl Insert als auch Update,
// plus optionales Abspeichern eines Uploads und zugehöriger Dokument-Daten.
func (app *application) upsertContract(c echo.Context, id *int64) (*sqlc.Contract, error) {
	// 1) Meta-JSON auslesen
	metaStr := c.FormValue("meta")
	if metaStr == "" {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "missing meta field")
	}
	var payload dtos.CreateContractDto
	if err := json.Unmarshal([]byte(metaStr), &payload); err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid meta JSON: "+err.Error())
	}

	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	qtx := app.queries.WithTx(tx)

	// 2) DB-Operation: Insert oder Update
	var contract *sqlc.Contract
	if id == nil {
		inserted, err := qtx.InsertContract(ctx, sqlc.InsertContractParams{
			Name:           payload.Name,
			Company:        payload.Company,
			ContractType:   payload.ContractType,
			Category:       payload.Category,
			StartDate:      time.Time(payload.StartDate),
			EndDate:        (*time.Time)(payload.EndDate),
			ContractNumber: payload.ContractNumber,
			CustomerNumber: payload.CustomerNumber,
			Costs:          payload.Costs,
			BillingPeriod:  payload.BillingPeriod,
			ContactPerson:  payload.ContactPerson,
			ContactAddress: payload.ContactAddress,
			ContactPhone:   payload.ContactPhone,
			ContactEmail:   payload.ContactEmail,
			IconSource:     payload.IconSource,
			Notes:          payload.Notes,
		})
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		contract = &inserted
	} else {
		// UpdateContractById liefert keinen Contract zurück, daher nachladen
		err := qtx.UpdateContractById(ctx, sqlc.UpdateContractByIdParams{
			ID:             *id,
			Name:           payload.Name,
			Company:        payload.Company,
			ContractType:   payload.ContractType,
			Category:       payload.Category,
			StartDate:      time.Time(payload.StartDate),
			EndDate:        (*time.Time)(payload.EndDate),
			ContractNumber: payload.ContractNumber,
			CustomerNumber: payload.CustomerNumber,
			Costs:          payload.Costs,
			BillingPeriod:  payload.BillingPeriod,
			ContactPerson:  payload.ContactPerson,
			ContactAddress: payload.ContactAddress,
			ContactPhone:   payload.ContactPhone,
			ContactEmail:   payload.ContactEmail,
			IconSource:     payload.IconSource,
			Notes:          payload.Notes,
		})
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		updated, err := qtx.FindContractById(ctx, *id)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		contract = &updated
	}

	// 3) Optional: Datei-Upload verarbeiten
	form, err := c.MultipartForm()
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "no multipart form found: "+err.Error())
	}
	files := form.File["file"]
	for _, fileHeader := range files {
		src, err := fileHeader.Open()
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "cannot open uploaded file: "+err.Error())
		}
		defer src.Close()

		docId := uuid.NewString()
		ext := filepath.Ext(fileHeader.Filename)
		docName := fmt.Sprintf("%s%s", docId, ext)

		if err := os.MkdirAll(app.uploadsDir, 0o755); err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "cannot create upload dir: "+err.Error())
		}
		dstPath := filepath.Join(app.uploadsDir, docName)
		dst, err := os.Create(dstPath)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "cannot create file: "+err.Error())
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "cannot save file: "+err.Error())
		}

		// Dokument in der DB speichern
		_, err = qtx.InsertDocument(ctx, sqlc.InsertDocumentParams{
			ContractID: contract.ID,
			Path:       docName,
			Title:      &fileHeader.Filename,
		})
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusInternalServerError, "cannot save document record: "+err.Error())
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// 4) Ergebnis zurückgeben
	return contract, nil
}

func (app *application) deleteContract(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	err = app.queries.DeleteContractSoft(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.String(http.StatusOK, "successfully deleted")
}

func (app *application) deleteDocument(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	err = app.queries.DeleteDocumentSoft(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.String(http.StatusOK, "successfully deleted")
}

func (app *application) updateDocument(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	var payload dtos.UpdateDocumentDto
	if err := BindAndValidate(ctx, &payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	doc, err := app.queries.FindDocumentById(ctx.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	err = app.queries.UpdateDocumentById(ctx.Request().Context(), sqlc.UpdateDocumentByIdParams{
		ID:    doc.ID,
		Title: &payload.Title,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return ctx.String(http.StatusOK, "successfully deleted")
}

func (app *application) searchLogos(ctx echo.Context) error {
	term := ctx.QueryParam("term")
	if term == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "term is required")
	}

	results, err := utils.SearchAppLogos(term)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var logos []dtos.LogoDto
	for _, res := range results {
		logos = append(logos, dtos.LogoDto{
			Name: res.TrackName,
			Logo: res.ArtworkUrl100,
		})
	}
	return ctx.JSON(http.StatusOK, logos)
}
