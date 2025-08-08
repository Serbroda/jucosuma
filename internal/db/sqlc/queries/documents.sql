-- name: InsertDocument :one
INSERT INTO documents (created_at,
                       updated_at,
                       contract_id,
                       path,
                       title)
VALUES (CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        sqlc.arg('contract_id'),
        sqlc.arg('path'),
        sqlc.arg('title')) RETURNING *
;

-- name: FindDocumentById :one
SELECT *
FROM documents
WHERE id = ?
  AND deleted_at IS NULL LIMIT 1
;

-- name: FindDocumentsByContractId :many
SELECT *
FROM documents
WHERE contract_id = ?
    AND deleted_at IS NULL
ORDER BY title ASC
;

-- name: UpdateDocumentById :exec
UPDATE documents
SET title = sqlc.arg('title'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
  AND deleted_at IS NULL
;

-- name: DeleteDocumentSoft :exec
UPDATE documents
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ?
;
