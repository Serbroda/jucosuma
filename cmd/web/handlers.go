package main

import (
	"encoding/json"
	"fmt"
	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

func (app *application) getContracts(ctx echo.Context) error {
	contracts, err := app.queries.FindAllContracts(ctx.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	json := utils.MapSlice(contracts, func(item sqlc.Contract) dtos.ContractDto {
		return dtos.MapContractToContractDto(item)
	})

	return ctx.JSON(http.StatusOK, json)
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

	json := dtos.MapContractToContractDto(contract)
	return ctx.JSON(http.StatusOK, json)
}

func (app *application) createContract(c echo.Context) error {
	// 1) Meta-JSON auslesen und in dein DTO unmarshaln
	metaStr := c.FormValue("meta")
	if metaStr == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing meta field")
	}
	var payload dtos.CreateContractDto
	if err := json.Unmarshal([]byte(metaStr), &payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid meta JSON: "+err.Error())
	}

	// 2) Jetzt wie gehabt in die DB schreiben
	contract, err := app.queries.InsertContract(c.Request().Context(), sqlc.InsertContractParams{
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
		IconSource:     payload.IconSource,
		Notes:          payload.Notes,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// 3) Datei aus dem FormData-Part holen
	fileHeader, err := c.FormFile("file")
	if err == nil {
		// 4) Datei öffnen und speichern
		src, err := fileHeader.Open()
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "cannot open uploaded file: "+err.Error())
		}
		defer src.Close()

		docId := uuid.NewString()
		ext := filepath.Ext(fileHeader.Filename)
		docName := fmt.Sprintf("%s%s", docId, ext)

		// Upload-Ordner anlegen
		os.MkdirAll("uploads", 0755)
		dstPath := filepath.Join("uploads", docName)
		dst, err := os.Create(dstPath)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "cannot create file: "+err.Error())
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "cannot save file: "+err.Error())
		}

		_, err = app.queries.InsertDocument(c.Request().Context(), sqlc.InsertDocumentParams{
			ContractID: contract.ID,
			Path:       docName,
			Title:      &fileHeader.Filename,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "cannot save file: "+err.Error())
		}
	}

	// 6) Erfolgsantwort zurückgeben
	return c.JSON(http.StatusOK, dtos.MapContractToContractDto(contract))
}

func (app *application) updateContract(ctx echo.Context) error {
	idParam := ctx.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var payload dtos.UpdateContractDto
	if err := BindAndValidate(ctx, &payload); err != nil {
		return err
	}

	err = app.queries.UpdateContractById(ctx.Request().Context(), sqlc.UpdateContractByIdParams{
		ID:             id,
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
		IconSource:     payload.IconSource,
		Notes:          payload.Notes,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return ctx.String(http.StatusOK, "successfully updated")
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
