package dtos

import (
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
)

func MapContractToContractDto(item sqlc.Contract) ContractDto {
	return ContractDto{
		ID:               item.ID,
		Name:             item.Name,
		Company:          item.Company,
		ContractType:     item.ContractType,
		Category:         item.Category,
		StartDate:        DateOnly(item.StartDate),
		EndDate:          (*DateOnly)(item.EndDate),
		ContractNumber:   item.ContractNumber,
		CustomerNumber:   item.CustomerNumber,
		ContractHolderID: nil,
		Costs:            item.Costs,
		BillingPeriod:    item.BillingPeriod,
		ContactPerson:    item.ContactPerson,
		ContactAddress:   item.ContactAddress,
		ContactPhone:     item.ContactPhone,
		ContactEmail:     item.ContactEmail,
		IconSource:       item.IconSource,
		Notes:            item.Notes,
		CreatedAt:        item.CreatedAt,
		UpdatedAt:        item.UpdatedAt,
	}
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
