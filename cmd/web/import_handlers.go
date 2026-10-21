package main

import (
	"encoding/csv"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

type importRow struct {
	Name           string `json:"name"`
	Company        string `json:"company"`
	Category       string `json:"category"`
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
	BillingPeriod  string `json:"billing_period"`
	Costs          string `json:"costs"`
	Currency       string `json:"currency"`
	ContractNumber string `json:"contract_number"`
	CustomerNumber string `json:"customer_number"`
	ContractHolder string `json:"contract_holder"`
	ContactPerson  string `json:"contact_person"`
	ContactEmail   string `json:"contact_email"`
	ContactPhone   string `json:"contact_phone"`
	Notes          string `json:"notes"`
	Error          string `json:"error,omitempty"`
}

type importResult struct {
	Rows     []importRow `json:"rows"`
	Imported int         `json:"imported"`
	Errors   int         `json:"errors"`
}

func (app *application) importContractsCSV(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "missing file")
	}

	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "cannot open file")
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "cannot read file")
	}

	// Strip BOM
	content := string(data)
	content = strings.TrimPrefix(content, "\xEF\xBB\xBF")

	reader := csv.NewReader(strings.NewReader(content))
	reader.Comma = ';'
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid CSV: "+err.Error())
	}

	if len(records) < 2 {
		return echo.NewHTTPError(http.StatusBadRequest, "CSV must have a header and at least one data row")
	}

	// Skip header
	rows := make([]importRow, 0, len(records)-1)
	for _, record := range records[1:] {
		if len(record) < 18 {
			rows = append(rows, importRow{Error: "not enough columns"})
			continue
		}
		// CSV columns: Name;Company;Category;Status;StartDate;EndDate;BillingPeriod;Costs;Currency;MonthlyCosts;NextBillingDate;ContractNumber;CustomerNumber;ContractHolder;ContactPerson;ContactEmail;ContactPhone;Notes
		rows = append(rows, importRow{
			Name:     record[0],
			Company:  record[1],
			Category: record[2],
			// record[3] = Status (computed, skip)
			StartDate:     record[4],
			EndDate:       record[5],
			BillingPeriod: record[6],
			Costs:         record[7],
			Currency:      record[8],
			// record[9] = Monthly Costs (computed, skip)
			// record[10] = Next Billing Date (computed, skip)
			ContractNumber: record[11],
			CustomerNumber: record[12],
			ContractHolder: record[13],
			ContactPerson:  record[14],
			ContactEmail:   record[15],
			ContactPhone:   record[16],
			Notes:          record[17],
		})
	}

	preview := c.QueryParam("preview") == "true"
	if preview {
		return c.JSON(http.StatusOK, importResult{Rows: rows})
	}

	// Import
	ctx := c.Request().Context()
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	qtx := app.queries.WithTx(tx)
	categories, err := app.loadCategories(ctx, qtx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	imported := 0
	errors := 0
	for i := range rows {
		row := &rows[i]
		if row.Error != "" {
			errors++
			continue
		}

		if row.Name == "" {
			row.Error = "name is required"
			errors++
			continue
		}

		startDate, err := time.Parse("2006-01-02", row.StartDate)
		if err != nil {
			row.Error = "invalid start_date"
			errors++
			continue
		}

		var endDate *time.Time
		if row.EndDate != "" {
			t, err := time.Parse("2006-01-02", row.EndDate)
			if err != nil {
				row.Error = "invalid end_date"
				errors++
				continue
			}
			endDate = &t
		}

		var costs *float64
		if row.Costs != "" {
			f, err := strconv.ParseFloat(row.Costs, 64)
			if err != nil {
				row.Error = "invalid costs"
				errors++
				continue
			}
			costs = &f
		}

		var currency *string
		if row.Currency != "" {
			currency = &row.Currency
		}

		var contractNumber, customerNumber, contractHolder *string
		var contactPerson, contactEmail, contactPhone, notes *string
		if row.ContractNumber != "" {
			contractNumber = &row.ContractNumber
		}
		if row.CustomerNumber != "" {
			customerNumber = &row.CustomerNumber
		}
		if row.ContractHolder != "" {
			contractHolder = &row.ContractHolder
		}
		if row.ContactPerson != "" {
			contactPerson = &row.ContactPerson
		}
		if row.ContactEmail != "" {
			contactEmail = &row.ContactEmail
		}
		if row.ContactPhone != "" {
			contactPhone = &row.ContactPhone
		}
		if row.Notes != "" {
			notes = &row.Notes
		}

		var company *string
		if row.Company != "" {
			company = &row.Company
		}

		billingPeriod := strings.ToUpper(row.BillingPeriod)
		if billingPeriod == "" {
			billingPeriod = "NONE"
		}

		categoryID, categoryName := categories.categoryParams(nil, row.Category, "EXPENSE")
		_, err = qtx.InsertContract(ctx, sqlc.InsertContractParams{
			Name:           row.Name,
			Company:        company,
			Category:       categoryName,
			CategoryID:     categoryID,
			StartDate:      startDate,
			EndDate:        endDate,
			ContractNumber: contractNumber,
			CustomerNumber: customerNumber,
			ContractHolder: contractHolder,
			BillingPeriod:  billingPeriod,
			Costs:          costs,
			Currency:       currency,
			ContactPerson:  contactPerson,
			ContactAddress: nil,
			ContactPhone:   contactPhone,
			ContactEmail:   contactEmail,
			IconSource:     nil,
			Notes:          notes,
			SplitBetween:   1,
			Kind:           "EXPENSE",
		})
		if err != nil {
			row.Error = "insert failed: " + err.Error()
			errors++
			continue
		}
		imported++
	}

	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, importResult{Rows: rows, Imported: imported, Errors: errors})
}
