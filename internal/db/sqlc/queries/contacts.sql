-- name: FindAllContacts :many
SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC;

-- name: FindContactById :one
SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: InsertContact :one
INSERT INTO contacts (name, icon_source, contact_person, address, phone, email, website, notes, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('icon_source'), sqlc.arg('contact_person'), sqlc.arg('address'), sqlc.arg('phone'),
        sqlc.arg('email'), sqlc.arg('website'), sqlc.arg('notes'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateContactById :exec
UPDATE contacts
SET name           = sqlc.arg('name'),
    icon_source    = sqlc.arg('icon_source'),
    contact_person = sqlc.arg('contact_person'),
    address        = sqlc.arg('address'),
    phone          = sqlc.arg('phone'),
    email          = sqlc.arg('email'),
    website        = sqlc.arg('website'),
    notes          = sqlc.arg('notes'),
    updated_at     = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: SyncContractCompanyName :exec
-- Keeps the readable provider name on linked entries in sync after a rename.
UPDATE contracts SET company = sqlc.arg('name')
WHERE contact_id = sqlc.arg('contact_id');

-- name: DetachContact :exec
-- Before a contact is deleted, its entries keep its data as their own (where they have none).
UPDATE contracts
SET contact_person  = COALESCE(NULLIF(contact_person, ''), sqlc.arg('contact_person')),
    contact_address = COALESCE(NULLIF(contact_address, ''), sqlc.arg('address')),
    contact_phone   = COALESCE(NULLIF(contact_phone, ''), sqlc.arg('phone')),
    contact_email   = COALESCE(NULLIF(contact_email, ''), sqlc.arg('email')),
    website         = COALESCE(NULLIF(website, ''), sqlc.arg('website')),
    contact_id      = NULL,
    updated_at      = CURRENT_TIMESTAMP
WHERE contact_id = sqlc.arg('contact_id');

-- name: DeleteContactSoft :exec
UPDATE contacts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
