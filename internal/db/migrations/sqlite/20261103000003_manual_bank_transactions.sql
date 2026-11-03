-- +goose Up
-- +goose StatementBegin
-- Bookings can also be entered by hand (e.g. cash spending): they belong to no import and may have
-- no account. SQLite cannot relax NOT NULL, so the table is rebuilt; nothing references it.
CREATE TABLE bank_transactions_new
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id         INTEGER REFERENCES bank_imports (id) ON DELETE CASCADE, -- NULL: entered by hand
    owner_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id        INTEGER REFERENCES accounts (id) ON DELETE CASCADE,
    fingerprint       TEXT    NOT NULL,
    booking_date      DATE    NOT NULL,
    value_date        DATE    NOT NULL,
    counterparty      TEXT    NOT NULL DEFAULT '',
    counterparty_iban TEXT,
    booking_text      TEXT    NOT NULL DEFAULT '',
    purpose           TEXT    NOT NULL DEFAULT '',
    reference         TEXT,
    creditor_id       TEXT,
    amount            NUMERIC NOT NULL,
    balance_after     NUMERIC,
    currency          TEXT    NOT NULL DEFAULT 'EUR',
    scope             TEXT    NOT NULL DEFAULT 'PRIVATE' CHECK (scope IN ('HOUSEHOLD', 'PRIVATE')),
    kind              TEXT CHECK (kind IN ('EXPENSE', 'INCOME', 'TRANSFER')),
    category_id       INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    contract_id       INTEGER REFERENCES contracts (id) ON DELETE SET NULL,
    classified_by     TEXT CHECK (classified_by IN ('RULE', 'MATCH', 'MANUAL', 'AI')),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, fingerprint)
);
INSERT INTO bank_transactions_new SELECT * FROM bank_transactions;
DROP TABLE bank_transactions;
ALTER TABLE bank_transactions_new RENAME TO bank_transactions;
CREATE INDEX idx_bank_transactions_owner_date ON bank_transactions (owner_id, booking_date);
CREATE INDEX idx_bank_transactions_import ON bank_transactions (import_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM bank_transactions WHERE import_id IS NULL OR account_id IS NULL;
CREATE TABLE bank_transactions_old
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id         INTEGER NOT NULL REFERENCES bank_imports (id) ON DELETE CASCADE,
    owner_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id        INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    fingerprint       TEXT    NOT NULL,
    booking_date      DATE    NOT NULL,
    value_date        DATE    NOT NULL,
    counterparty      TEXT    NOT NULL DEFAULT '',
    counterparty_iban TEXT,
    booking_text      TEXT    NOT NULL DEFAULT '',
    purpose           TEXT    NOT NULL DEFAULT '',
    reference         TEXT,
    creditor_id       TEXT,
    amount            NUMERIC NOT NULL,
    balance_after     NUMERIC,
    currency          TEXT    NOT NULL DEFAULT 'EUR',
    scope             TEXT    NOT NULL DEFAULT 'PRIVATE' CHECK (scope IN ('HOUSEHOLD', 'PRIVATE')),
    kind              TEXT CHECK (kind IN ('EXPENSE', 'INCOME', 'TRANSFER')),
    category_id       INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    contract_id       INTEGER REFERENCES contracts (id) ON DELETE SET NULL,
    classified_by     TEXT CHECK (classified_by IN ('RULE', 'MATCH', 'MANUAL', 'AI')),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, fingerprint)
);
INSERT INTO bank_transactions_old SELECT * FROM bank_transactions;
DROP TABLE bank_transactions;
ALTER TABLE bank_transactions_old RENAME TO bank_transactions;
CREATE INDEX idx_bank_transactions_owner_date ON bank_transactions (owner_id, booking_date);
CREATE INDEX idx_bank_transactions_import ON bank_transactions (import_id);
-- +goose StatementEnd
