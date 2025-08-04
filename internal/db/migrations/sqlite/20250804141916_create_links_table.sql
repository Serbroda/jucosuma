-- +goose Up
-- +goose StatementBegin
CREATE TABLE links
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    url        TEXT NOT NULL,
    title      TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    CONSTRAINT fk_links_contract_id FOREIGN KEY (contract_id) REFERENCES contracts (id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE links;
-- +goose StatementEnd
