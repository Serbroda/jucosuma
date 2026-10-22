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
                       website,
                       icon_source,
                       notes,
                       owner_id,
                       split_between,
                       kind,
                       account_id,
                       target_account_id,
                       goal_id,
                       category_id,
                       term_months,
                       notice_period,
                       notice_unit,
                       is_contract,
                       is_variable,
                       transfer_type)
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
        sqlc.arg('website'),
        sqlc.arg('icon_source'),
        sqlc.arg('notes'),
        sqlc.arg('owner_id'),
        sqlc.arg('split_between'),
        sqlc.arg('kind'),
        sqlc.arg('account_id'),
        sqlc.arg('target_account_id'),
        sqlc.arg('goal_id'),
        sqlc.arg('category_id'),
        sqlc.arg('term_months'),
        sqlc.arg('notice_period'),
        sqlc.arg('notice_unit'),
        sqlc.arg('is_contract'),
        sqlc.arg('is_variable'),
        sqlc.arg('transfer_type')) RETURNING *
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
    website           = sqlc.arg('website'),
    icon_source       = sqlc.arg('icon_source'),
    notes             = sqlc.arg('notes'),
    owner_id          = sqlc.arg('owner_id'),
    split_between     = sqlc.arg('split_between'),
    kind              = sqlc.arg('kind'),
    account_id        = sqlc.arg('account_id'),
    target_account_id = sqlc.arg('target_account_id'),
    goal_id           = sqlc.arg('goal_id'),
    category_id       = sqlc.arg('category_id'),
    term_months       = sqlc.arg('term_months'),
    notice_period     = sqlc.arg('notice_period'),
    notice_unit       = sqlc.arg('notice_unit'),
    is_contract       = sqlc.arg('is_contract'),
    is_variable       = sqlc.arg('is_variable'),
    transfer_type     = sqlc.arg('transfer_type'),
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
  AND (owner_id IS NULL OR owner_id = sqlc.arg('user_id'))
  AND contract_holder IS NOT NULL
ORDER BY contract_holder ASC
;

-- name: FindUsedIcons :many
SELECT DISTINCT icon_source
FROM contracts
WHERE deleted_at IS NULL
  AND (owner_id IS NULL OR owner_id = sqlc.arg('user_id'))
  AND icon_source IS NOT NULL
  AND icon_source != ''
ORDER BY name ASC
;

-- name: FindCompanies :many
SELECT DISTINCT company
FROM contracts
WHERE deleted_at IS NULL
  AND (owner_id IS NULL OR owner_id = sqlc.arg('user_id'))
  AND company IS NOT NULL
ORDER BY company ASC
;
