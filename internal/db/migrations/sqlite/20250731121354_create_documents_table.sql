-- +goose Up
-- +goose StatementBegin
CREATE TABLE documents
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    path        TEXT    NOT NULL,
    title       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at  DATETIME,
    CONSTRAINT fk_documents_contract_id FOREIGN KEY (contract_id) REFERENCES contracts (id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE documents;
-- +goose StatementEnd
