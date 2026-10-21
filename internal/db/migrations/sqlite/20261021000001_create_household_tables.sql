-- +goose Up
-- +goose StatementBegin
CREATE TABLE persons
(
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    in_household INTEGER NOT NULL DEFAULT 1,
    user_id      INTEGER REFERENCES users (id) ON DELETE SET NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at   DATETIME
);

CREATE TABLE accounts
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'CHECKING' CHECK (type IN ('CHECKING', 'SAVINGS', 'DEPOT', 'CASH', 'OTHER')),
    person_id  INTEGER REFERENCES persons (id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

ALTER TABLE contracts ADD COLUMN kind TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (kind IN ('EXPENSE', 'INCOME', 'TRANSFER'));
ALTER TABLE contracts ADD COLUMN account_id INTEGER REFERENCES accounts (id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN target_account_id INTEGER REFERENCES accounts (id) ON DELETE SET NULL;

CREATE TABLE contract_shares
(
    contract_id INTEGER NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
    person_id   INTEGER NOT NULL REFERENCES persons (id) ON DELETE CASCADE,
    weight      REAL    NOT NULL CHECK (weight > 0),
    PRIMARY KEY (contract_id, person_id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contract_shares;
ALTER TABLE contracts DROP COLUMN target_account_id;
ALTER TABLE contracts DROP COLUMN account_id;
ALTER TABLE contracts DROP COLUMN kind;
DROP TABLE accounts;
DROP TABLE persons;
-- +goose StatementEnd
