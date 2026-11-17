-- name: FindInvestPlansByOwner :many
SELECT * FROM invest_plans WHERE owner_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC;

-- name: FindInvestPlanItemsByOwner :many
SELECT i.*
FROM invest_plan_items i
         JOIN invest_plans p ON p.id = i.plan_id
WHERE p.owner_id = ?
ORDER BY i.plan_id ASC, i.sort_order ASC, i.id ASC;

-- name: InsertInvestPlan :one
INSERT INTO invest_plans (owner_id, name, amount)
VALUES (sqlc.arg('owner_id'), sqlc.arg('name'), sqlc.arg('amount'))
RETURNING *;

-- name: UpdateInvestPlan :execrows
UPDATE invest_plans
SET name       = sqlc.arg('name'),
    amount     = sqlc.arg('amount'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id');

-- name: DeleteInvestPlan :execrows
DELETE FROM invest_plans WHERE id = sqlc.arg('id') AND owner_id = sqlc.arg('owner_id');

-- name: InsertInvestPlanItem :exec
INSERT INTO invest_plan_items (plan_id, name, mode, value, account_id, sort_order)
VALUES (sqlc.arg('plan_id'), sqlc.arg('name'), sqlc.arg('mode'), sqlc.arg('value'), sqlc.arg('account_id'), sqlc.arg('sort_order'));

-- name: DeleteInvestPlanItems :exec
DELETE FROM invest_plan_items WHERE plan_id = ?;
