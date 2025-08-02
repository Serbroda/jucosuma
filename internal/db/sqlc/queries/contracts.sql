-- name: InsertContract :one
INSERT INTO contracts (created_at,
                       updated_at,
                       name,
                       company,
                       category,
                       costs,
                       icon_source)
VALUES (CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        sqlc.arg('name'),
        sqlc.arg('company'),
        sqlc.arg('category'),
        sqlc.arg('costs'),
        sqlc.arg('icon_source')) RETURNING *
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
    category = sqlc.arg('category'),
    costs = sqlc.arg('costs'),
    icon_source = sqlc.arg('icon_source'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
  AND deleted_at IS NULL
;

-- name: DeleteContractSoft :exec
UPDATE contracts
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;
