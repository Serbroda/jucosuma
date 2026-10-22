-- +goose Up
-- +goose StatementBegin
-- Website of the provider and further links per entry (customer portal, documents in Paperless, …).
ALTER TABLE contracts ADD COLUMN website TEXT;

CREATE TABLE contract_links
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contract_links;
ALTER TABLE contracts DROP COLUMN website;
-- +goose StatementEnd
