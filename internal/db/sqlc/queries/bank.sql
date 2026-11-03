-- name: InsertBankImport :one
INSERT INTO bank_imports (owner_id, account_id, bank, filename, period_from, period_to, created_at)
VALUES (sqlc.arg('owner_id'), sqlc.arg('account_id'), sqlc.arg('bank'), sqlc.arg('filename'),
        sqlc.arg('period_from'), sqlc.arg('period_to'), CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateBankImportCounts :exec
UPDATE bank_imports SET imported = sqlc.arg('imported'), duplicates = sqlc.arg('duplicates') WHERE id = sqlc.arg('id');

-- name: FindBankImportsByOwner :many
SELECT bi.id, bi.account_id, bi.bank, bi.filename, bi.period_from, bi.period_to, bi.imported, bi.duplicates,
       bi.created_at, bi.closed_at, bi.purged_at,
       (SELECT COUNT(*) FROM bank_transactions t WHERE t.import_id = bi.id)                                AS total,
       (SELECT COUNT(*) FROM bank_transactions t WHERE t.import_id = bi.id AND t.category_id IS NOT NULL) AS classified
FROM bank_imports bi
WHERE bi.owner_id = ?
ORDER BY bi.created_at DESC, bi.id DESC;

-- name: CloseBankImport :execrows
UPDATE bank_imports SET closed_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id') AND closed_at IS NULL;

-- name: ReopenBankImport :execrows
UPDATE bank_imports SET closed_at = NULL
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id') AND purged_at IS NULL;

-- name: PurgeBankTransactions :execrows
UPDATE bank_transactions
SET counterparty = '', counterparty_iban = NULL, booking_text = '', purpose = '', reference = NULL, creditor_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE import_id IN (SELECT id FROM bank_imports WHERE closed_at IS NOT NULL AND purged_at IS NULL AND closed_at < sqlc.arg('closed_before'));

-- name: MarkBankImportsPurged :execrows
UPDATE bank_imports SET purged_at = CURRENT_TIMESTAMP
WHERE closed_at IS NOT NULL AND purged_at IS NULL AND closed_at < sqlc.arg('closed_before');

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

-- name: FindBankTransactionsByImport :many
SELECT * FROM bank_transactions
WHERE owner_id = sqlc.arg('owner_id') AND import_id = sqlc.arg('import_id')
ORDER BY booking_date ASC, id ASC;

-- name: FindBankTransactionsByOwner :many
SELECT * FROM bank_transactions
WHERE owner_id = sqlc.arg('owner_id') AND booking_date >= sqlc.arg('date_from') AND booking_date < sqlc.arg('date_to')
ORDER BY booking_date DESC, id DESC;

-- name: UpdateBankTransactionScope :execrows
UPDATE bank_transactions SET scope = sqlc.arg('scope'), updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id');

-- name: UpdateBankTransactionCategory :execrows
UPDATE bank_transactions
SET category_id   = sqlc.arg('category_id'),
    contract_id   = sqlc.arg('contract_id'),
    classified_by = sqlc.arg('classified_by'),
    updated_at    = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id');

-- name: SumHouseholdBankTransactions :many
-- Totals of the bookings counting for the household, of all users: only sums leave the server.
SELECT category_id, contract_id, owner_id, CAST(SUM(amount) AS REAL) AS total, COUNT(*) AS bookings
FROM bank_transactions
WHERE scope = 'HOUSEHOLD' AND booking_date >= sqlc.arg('date_from') AND booking_date < sqlc.arg('date_to')
GROUP BY category_id, contract_id, owner_id;

-- name: FindBankImportPeriods :many
SELECT account_id, period_from, period_to FROM bank_imports WHERE period_from IS NOT NULL AND period_to IS NOT NULL;

-- name: FindLastBankBalances :many
-- Bookings with balance on the last booking day before date_to, per account.
SELECT t.account_id, t.booking_date, t.amount, t.balance_after
FROM bank_transactions t
WHERE t.balance_after IS NOT NULL AND t.account_id IS NOT NULL
  AND t.booking_date = (SELECT MAX(t2.booking_date)
                        FROM bank_transactions t2
                        WHERE t2.account_id = t.account_id AND t2.balance_after IS NOT NULL AND t2.booking_date < sqlc.arg('date_to'));

-- name: InsertManualBankTransaction :one
INSERT INTO bank_transactions (owner_id, account_id, fingerprint, booking_date, value_date, counterparty, purpose, amount,
                               currency, scope, category_id, contract_id, classified_by, created_at, updated_at)
VALUES (sqlc.arg('owner_id'), sqlc.arg('account_id'), sqlc.arg('fingerprint'), sqlc.arg('booking_date'), sqlc.arg('booking_date'),
        sqlc.arg('counterparty'), sqlc.arg('purpose'), sqlc.arg('amount'), sqlc.arg('currency'), sqlc.arg('scope'),
        sqlc.arg('category_id'), sqlc.arg('contract_id'), sqlc.arg('classified_by'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateManualBankTransaction :execrows
UPDATE bank_transactions
SET account_id    = sqlc.arg('account_id'),
    booking_date  = sqlc.arg('booking_date'),
    value_date    = sqlc.arg('booking_date'),
    counterparty  = sqlc.arg('counterparty'),
    purpose       = sqlc.arg('purpose'),
    amount        = sqlc.arg('amount'),
    scope         = sqlc.arg('scope'),
    category_id   = sqlc.arg('category_id'),
    contract_id   = sqlc.arg('contract_id'),
    classified_by = sqlc.arg('classified_by'),
    updated_at    = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id') AND import_id IS NULL;

-- name: DeleteManualBankTransaction :execrows
DELETE FROM bank_transactions WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id') AND import_id IS NULL;
