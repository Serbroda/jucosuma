-- name: FindAllContractAmounts :many
SELECT * FROM contract_amounts ORDER BY contract_id, valid_from;

-- name: FindContractAmountsByContractId :many
SELECT * FROM contract_amounts WHERE contract_id = ? ORDER BY valid_from;

-- name: UpsertContractAmount :exec
INSERT INTO contract_amounts (contract_id, valid_from, costs)
VALUES (?, ?, ?)
ON CONFLICT (contract_id, valid_from) DO UPDATE SET costs = excluded.costs;

-- name: UpdateContractAmountCosts :exec
UPDATE contract_amounts SET costs = ? WHERE id = ?;

-- name: DeleteContractAmount :exec
DELETE FROM contract_amounts WHERE id = ? AND contract_id = ?;

-- name: UpdateContractBaseCosts :exec
UPDATE contracts SET costs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UpdateContractAmount :exec
UPDATE contract_amounts SET valid_from = ?, costs = ? WHERE id = ? AND contract_id = ?;
