-- +goose Up
-- +goose StatementBegin
-- Contacts (providers, insurers, landlords, …) are maintained once and linked from entries.
-- Contact fields on an entry stay: they are used without a contact and override the contact's data.
CREATE TABLE contacts
(
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    icon_source    TEXT,
    contact_person TEXT,
    address        TEXT,
    phone          TEXT,
    email          TEXT,
    website        TEXT,
    notes          TEXT,
    created_at     DATETIME,
    updated_at     DATETIME,
    deleted_at     DATETIME
);

ALTER TABLE contracts ADD COLUMN contact_id INTEGER REFERENCES contacts (id) ON DELETE SET NULL;
CREATE INDEX idx_contracts_contact_id ON contracts (contact_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX idx_contracts_contact_id;
ALTER TABLE contracts DROP COLUMN contact_id;
DROP TABLE contacts;
-- +goose StatementEnd
