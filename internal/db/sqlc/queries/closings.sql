-- name: FindAllMonthClosings :many
SELECT * FROM month_closings ORDER BY month DESC;

-- name: FindMonthClosingByMonth :one
SELECT * FROM month_closings WHERE month = ? LIMIT 1;

-- name: FindLatestMonthClosing :one
SELECT * FROM month_closings ORDER BY month DESC LIMIT 1;

-- name: InsertMonthClosing :one
INSERT INTO month_closings (month, notes, created_by, created_at, updated_at)
VALUES (sqlc.arg('month'), sqlc.arg('notes'), sqlc.arg('created_by'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateMonthClosingNotes :exec
UPDATE month_closings SET notes = sqlc.arg('notes'), updated_at = CURRENT_TIMESTAMP WHERE id = sqlc.arg('id');

-- name: DeleteMonthClosing :exec
DELETE FROM month_closings WHERE id = ?;

-- name: FindAllMonthClosingBalances :many
SELECT * FROM month_closing_balances;

-- name: DeleteMonthClosingBalances :exec
DELETE FROM month_closing_balances WHERE closing_id = ?;

-- name: InsertMonthClosingBalance :exec
INSERT INTO month_closing_balances (closing_id, account_id, balance)
VALUES (sqlc.arg('closing_id'), sqlc.arg('account_id'), sqlc.arg('balance'));

-- name: FindAllMonthClosingActuals :many
SELECT * FROM month_closing_actuals;

-- name: DeleteMonthClosingActuals :exec
DELETE FROM month_closing_actuals WHERE closing_id = ?;

-- name: InsertMonthClosingActual :exec
INSERT INTO month_closing_actuals (closing_id, category_id, amount)
VALUES (sqlc.arg('closing_id'), sqlc.arg('category_id'), sqlc.arg('amount'));

-- name: UpdateAccountBalance :exec
UPDATE accounts SET balance = sqlc.arg('balance'), balance_date = sqlc.arg('balance_date'), updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;
