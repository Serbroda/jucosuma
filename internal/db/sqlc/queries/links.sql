-- name: FindAllContractLinks :many
SELECT * FROM contract_links ORDER BY contract_id, sort_order, id;

-- name: FindContractLinksByContractId :many
SELECT * FROM contract_links WHERE contract_id = ? ORDER BY sort_order, id;

-- name: DeleteContractLinksByContractId :exec
DELETE FROM contract_links WHERE contract_id = ?;

-- name: InsertContractLink :exec
INSERT INTO contract_links (contract_id, title, url, sort_order) VALUES (?, ?, ?, ?);
