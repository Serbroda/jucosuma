-- name: InsertBankImport :one
INSERT INTO bank_imports (owner_id, account_id, bank, filename, period_from, period_to, created_at)
VALUES (sqlc.arg('owner_id'), sqlc.arg('account_id'), sqlc.arg('bank'), sqlc.arg('filename'),
        sqlc.arg('period_from'), sqlc.arg('period_to'), CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateBankImportCounts :exec
UPDATE bank_imports SET imported = sqlc.arg('imported'), duplicates = sqlc.arg('duplicates') WHERE id = sqlc.arg('id');

-- name: FindBankImportsByOwner :many
SELECT * FROM bank_imports WHERE owner_id = ? ORDER BY created_at DESC, id DESC;

-- name: FindBankImportByIdAndOwner :one
SELECT * FROM bank_imports WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id') LIMIT 1;

-- name: DeleteBankImport :exec
DELETE FROM bank_imports WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id');

-- name: ExistsBankTransaction :one
SELECT COUNT(*) FROM bank_transactions WHERE account_id = sqlc.arg('account_id') AND fingerprint = sqlc.arg('fingerprint');

-- name: InsertBankTransaction :exec
INSERT INTO bank_transactions (import_id, owner_id, account_id, fingerprint, booking_date, value_date, counterparty,
                               counterparty_iban, booking_text, purpose, reference, creditor_id, amount, balance_after,
                               currency, scope, created_at, updated_at)
VALUES (sqlc.arg('import_id'), sqlc.arg('owner_id'), sqlc.arg('account_id'), sqlc.arg('fingerprint'), sqlc.arg('booking_date'),
        sqlc.arg('value_date'), sqlc.arg('counterparty'), sqlc.arg('counterparty_iban'), sqlc.arg('booking_text'),
        sqlc.arg('purpose'), sqlc.arg('reference'), sqlc.arg('creditor_id'), sqlc.arg('amount'), sqlc.arg('balance_after'),
        sqlc.arg('currency'), sqlc.arg('scope'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- name: FindBankTransactionsByOwner :many
SELECT * FROM bank_transactions
WHERE owner_id = sqlc.arg('owner_id') AND booking_date >= sqlc.arg('date_from') AND booking_date < sqlc.arg('date_to')
ORDER BY booking_date DESC, id DESC;
