-- name: InsertAgreement :one
INSERT INTO agreements (created_at,
                       updated_at,
                       name,
                       company,
                       category,
                       start_date,
                       end_date,
                       contract_number,
                       customer_number,
                       contract_holder,
                       notes,
                       billing_period,
                       costs,
                       currency,
                       next_billing_date,
                       contact_person,
                       contact_address,
                       contact_phone,
                       contact_email,
                       icon_source)
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
        sqlc.arg('notes'),
        sqlc.arg('billing_period'),
        sqlc.arg('costs'),
        sqlc.arg('currency'),
        sqlc.arg('next_billing_date'),
        sqlc.arg('contact_person'),
        sqlc.arg('contact_address'),
        sqlc.arg('contact_phone'),
        sqlc.arg('contact_email'),
        sqlc.arg('icon_source')) RETURNING *
;

-- name: FindAgreementById :one
SELECT *
FROM agreements
WHERE id = ?
  AND deleted_at IS NULL LIMIT 1
;

-- name: FindAllAgreements :many
SELECT *
FROM agreements
WHERE deleted_at IS NULL
ORDER BY name ASC
;

-- name: UpdateAgreementById :exec
UPDATE agreements
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
    updated_at        = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
  AND deleted_at IS NULL
;

-- name: DeleteAgreementSoft :exec
UPDATE agreements
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;

-- name: FindAgreementHolders :many
SELECT DISTINCT contract_holder
FROM agreements
WHERE deleted_at IS NULL
  AND contract_holder IS NOT NULL
ORDER BY contract_holder ASC
;
