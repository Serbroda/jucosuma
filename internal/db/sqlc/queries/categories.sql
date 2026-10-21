-- name: FindAllCategories :many
SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertCategory :one
INSERT INTO categories (name, sort_order, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('sort_order'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: FindCategoryById :one
SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL LIMIT 1;

-- name: UpdateCategoryById :exec
-- A renamed predefined category becomes a custom one (its key and translation no longer apply).
UPDATE categories
SET key        = CASE WHEN name = sqlc.arg('name') THEN key ELSE NULL END,
    name       = sqlc.arg('name'),
    sort_order = sqlc.arg('sort_order'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: RenameContractCategory :exec
UPDATE contracts SET category = sqlc.arg('new_name'), updated_at = CURRENT_TIMESTAMP
WHERE category = sqlc.arg('old_name');

-- name: DeleteCategorySoft :exec
UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
