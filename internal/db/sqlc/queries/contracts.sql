-- name: InsertContract :one
INSERT INTO contracts (created_at,
                       updated_at,
                       name,
                       company,
                       category,
                       start_date,
                       end_date,
                       contract_number,
                       customer_number,
                       contract_holder,
                       billing_period,
                       costs,
                       currency,
                       next_billing_date,
                       contact_person,
                       contact_address,
                       contact_phone,
                       contact_email,
                       icon_source,
                       notes,
                       owner_id,
                       split_between)
VALUES (CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        sqlc.arg('name'),
        sqlc.arg('company'),
        sqlc.arg('category'),
        sqlc.arg('start_date'),
        sqlc.arg('end_date'),
        sqlc.arg('contract_number'),
        sqlc.arg('customer_number'),
        sqlc.arg('contract_holder'),
        sqlc.arg('billing_period'),
        sqlc.arg('costs'),
        sqlc.arg('currency'),
        sqlc.arg('next_billing_date'),
        sqlc.arg('contact_person'),
        sqlc.arg('contact_address'),
        sqlc.arg('contact_phone'),
        sqlc.arg('contact_email'),
        sqlc.arg('icon_source'),
        sqlc.arg('notes'),
        sqlc.arg('owner_id'),
        sqlc.arg('split_between')) RETURNING *
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
ORDER BY name ASC
;

-- name: FindContractsForUser :many
SELECT *
FROM contracts
WHERE deleted_at IS NULL
  AND (owner_id IS NULL OR owner_id = sqlc.arg('user_id'))
ORDER BY name ASC
;

-- name: UpdateContractById :exec
UPDATE contracts
SET name              = sqlc.arg('name'),
    company           = sqlc.arg('company'),
    category          = sqlc.arg('category'),
    start_date        = sqlc.arg('start_date'),
    end_date          = sqlc.arg('end_date'),
    contract_number   = sqlc.arg('contract_number'),
    customer_number   = sqlc.arg('customer_number'),
    contract_holder   = sqlc.arg('contract_holder'),
    billing_period    = sqlc.arg('billing_period'),
    costs             = sqlc.arg('costs'),
    currency          = sqlc.arg('currency'),
    next_billing_date = sqlc.arg('next_billing_date'),
    contact_person    = sqlc.arg('contact_person'),
    contact_address   = sqlc.arg('contact_address'),
    contact_phone     = sqlc.arg('contact_phone'),
    contact_email     = sqlc.arg('contact_email'),
    icon_source       = sqlc.arg('icon_source'),
    notes             = sqlc.arg('notes'),
    owner_id          = sqlc.arg('owner_id'),
    split_between     = sqlc.arg('split_between'),
    updated_at        = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
  AND deleted_at IS NULL
;

-- name: DeleteContractSoft :exec
UPDATE contracts
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;

-- name: FindContractHolders :many
SELECT DISTINCT contract_holder
FROM contracts
WHERE deleted_at IS NULL
  AND contract_holder IS NOT NULL
ORDER BY contract_holder ASC
;
