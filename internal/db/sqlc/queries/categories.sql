-- name: FindAllCategories :many
SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertCategory :one
INSERT INTO categories (name, sort_order, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('sort_order'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateCategoryById :exec
UPDATE categories SET name = sqlc.arg('name'), sort_order = sqlc.arg('sort_order'), updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: DeleteCategorySoft :exec
UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
