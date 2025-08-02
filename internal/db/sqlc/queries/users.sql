-- name: InsertUser :one
INSERT INTO users (created_at,
                   updated_at,
                   name)
VALUES (CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        sqlc.arg('name')) RETURNING *
;

-- name: FindUserById :one
SELECT *
FROM users
WHERE id = ?
  AND deleted_at IS NULL LIMIT 1;

-- name: DeleteUserSoft :exec
UPDATE users
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;
