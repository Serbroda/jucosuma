-- name: InsertSession :one
INSERT INTO sessions (id, user_id, expires_at, created_at)
VALUES (sqlc.arg('id'), sqlc.arg('user_id'), sqlc.arg('expires_at'), CURRENT_TIMESTAMP)
RETURNING *;

-- name: FindSessionById :one
SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP;

-- name: DeleteSessionsByUserId :exec
DELETE FROM sessions WHERE user_id = ?;
