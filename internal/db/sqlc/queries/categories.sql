-- name: FindAllCategories :many
SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertCategory :one
INSERT INTO categories (name, sort_order, type, color, icon, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('sort_order'), sqlc.arg('type'), sqlc.arg('color'), sqlc.arg('icon'),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: FindCategoryById :one
SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: UpdateCategoryById :exec
-- A renamed predefined category becomes a custom one (its key and translation no longer apply).
UPDATE categories
SET key        = CASE WHEN name = sqlc.arg('name') THEN key ELSE NULL END,
    name       = sqlc.arg('name'),
    sort_order = sqlc.arg('sort_order'),
    type       = sqlc.arg('type'),
    color      = sqlc.arg('color'),
    icon       = sqlc.arg('icon'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: SyncContractCategoryName :exec
-- Keeps the readable name copy on entries in sync after a rename.
UPDATE contracts SET category = sqlc.arg('name')
WHERE category_id = sqlc.arg('category_id');

-- name: ReassignContractCategory :exec
UPDATE contracts SET category_id = sqlc.arg('new_id'), category = sqlc.arg('new_name'), updated_at = CURRENT_TIMESTAMP
WHERE category_id = sqlc.arg('old_id');

-- name: DeleteCategorySoft :exec
UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
