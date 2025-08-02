-- name: InsertContract :one
INSERT INTO contracts (created_at,
                       updated_at,
                       name,
                       company,
                       contract_type,
                       category,
                       start_date,
                       end_date,
                       contract_number,
                       customer_number,
                       contract_holder_id,
                       costs,
                       billing_period,
                       icon_source,
                       notes)
VALUES (CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        sqlc.arg('name'),
        sqlc.arg('company'),
        sqlc.arg('contract_type'),
        sqlc.arg('category'),
        sqlc.arg('start_date'),
        sqlc.arg('end_date'),
        sqlc.arg('contract_number'),
        sqlc.arg('customer_number'),
        sqlc.arg('contract_holder_id'),
        sqlc.arg('costs'),
        sqlc.arg('billing_period'),
        sqlc.arg('icon_source'),
        sqlc.arg('notes')) RETURNING *
;

-- name: FindContractById :one
SELECT *
FROM contracts
WHERE id = ?
  AND deleted_at IS NULL LIMIT 1
;

-- name: FindAllContracts :many
SELECT *
FROM contracts
WHERE deleted_at IS NULL
;

-- name: UpdateContractById :exec
UPDATE contracts
SET name = sqlc.arg('name'),
    company = sqlc.arg('company'),
    contract_type = sqlc.arg('contract_type'),
    category = sqlc.arg('category'),
    start_date = sqlc.arg('start_date'),
    end_date = sqlc.arg('end_date'),
    contract_number = sqlc.arg('contract_number'),
    customer_number = sqlc.arg('customer_number'),
    contract_holder_id = sqlc.arg('contract_holder_id'),
    costs = sqlc.arg('costs'),
    billing_period = sqlc.arg('billing_period'),
    icon_source = sqlc.arg('icon_source'),
    notes = sqlc.arg('notes'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
  AND deleted_at IS NULL
;

-- name: DeleteContractSoft :exec
UPDATE contracts
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;
