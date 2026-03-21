-- name: FindUserByUsername :one
SELECT * FROM users WHERE username = ? LIMIT 1;

-- name: FindUserById :one
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: FindAllUsers :many
SELECT * FROM users ORDER BY username ASC;

-- name: InsertUser :one
INSERT INTO users (username, password, role, must_change_password, created_at, updated_at)
VALUES (sqlc.arg('username'), sqlc.arg('password'), sqlc.arg('role'), sqlc.arg('must_change_password'),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users SET password = sqlc.arg('password'), must_change_password = 0, updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: UpdateUser :exec
UPDATE users SET username = sqlc.arg('username'), role = sqlc.arg('role'), updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id');

-- name: DeleteUser :exec
DELETE FROM users WHERE id = ?;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;
