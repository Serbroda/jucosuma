package dtos

import sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"

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
		IconSource:       item.IconSource,
		Notes:            item.Notes,
		CreatedAt:        item.CreatedAt,
		UpdatedAt:        item.UpdatedAt,
	}
}
