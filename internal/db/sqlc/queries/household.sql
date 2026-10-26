-- name: FindAllPersons :many
SELECT * FROM persons WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertPerson :one
INSERT INTO persons (name, in_household, user_id, sort_order, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('in_household'), sqlc.arg('user_id'), sqlc.arg('sort_order'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdatePersonById :exec
UPDATE persons
SET name         = sqlc.arg('name'),
    in_household = sqlc.arg('in_household'),
    user_id      = sqlc.arg('user_id'),
    sort_order   = sqlc.arg('sort_order'),
    updated_at   = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: DeletePersonSoft :exec
UPDATE persons SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: FindAllAccounts :many
SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertAccount :one
INSERT INTO accounts (name, type, person_id, sort_order, is_savings, iban, balance, balance_date, goal_amount, goal_date, icon, color, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('type'), sqlc.arg('person_id'), sqlc.arg('sort_order'), sqlc.arg('is_savings'), sqlc.arg('iban'),
        sqlc.arg('balance'), sqlc.arg('balance_date'), sqlc.arg('goal_amount'), sqlc.arg('goal_date'), sqlc.arg('icon'), sqlc.arg('color'),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateAccountById :exec
UPDATE accounts
SET name       = sqlc.arg('name'),
    type       = sqlc.arg('type'),
    person_id  = sqlc.arg('person_id'),
    sort_order = sqlc.arg('sort_order'),
    is_savings   = sqlc.arg('is_savings'),
    iban         = sqlc.arg('iban'),
    balance      = sqlc.arg('balance'),
    balance_date = sqlc.arg('balance_date'),
    goal_amount  = sqlc.arg('goal_amount'),
    goal_date    = sqlc.arg('goal_date'),
    icon         = sqlc.arg('icon'),
    color        = sqlc.arg('color'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: DeleteAccountSoft :exec
UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: FindAllContractShares :many
SELECT * FROM contract_shares ORDER BY contract_id, person_id;

-- name: FindContractSharesByContractId :many
SELECT * FROM contract_shares WHERE contract_id = ? ORDER BY person_id;

-- name: DeleteContractSharesByContractId :exec
DELETE FROM contract_shares WHERE contract_id = ?;

-- name: InsertContractShare :exec
INSERT INTO contract_shares (contract_id, person_id, weight, amount)
VALUES (sqlc.arg('contract_id'), sqlc.arg('person_id'), sqlc.arg('weight'), sqlc.arg('amount'));

-- name: FindAllSavingsGoals :many
SELECT * FROM savings_goals WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC;

-- name: InsertSavingsGoal :one
INSERT INTO savings_goals (name, kind, icon, color, person_id, account_id, target_amount, target_date,
                           current_amount, current_date, sort_order, created_at, updated_at)
VALUES (sqlc.arg('name'), sqlc.arg('kind'), sqlc.arg('icon'), sqlc.arg('color'), sqlc.arg('person_id'),
        sqlc.arg('account_id'), sqlc.arg('target_amount'), sqlc.arg('target_date'), sqlc.arg('current_amount'),
        sqlc.arg('current_date'), sqlc.arg('sort_order'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateSavingsGoalById :exec
UPDATE savings_goals
SET name           = sqlc.arg('name'),
    kind           = sqlc.arg('kind'),
    icon           = sqlc.arg('icon'),
    color          = sqlc.arg('color'),
    person_id      = sqlc.arg('person_id'),
    account_id     = sqlc.arg('account_id'),
    target_amount  = sqlc.arg('target_amount'),
    target_date    = sqlc.arg('target_date'),
    current_amount = sqlc.arg('current_amount'),
    current_date   = sqlc.arg('current_date'),
    sort_order     = sqlc.arg('sort_order'),
    updated_at     = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND deleted_at IS NULL;

-- name: DeleteSavingsGoalSoft :exec
UPDATE savings_goals SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
