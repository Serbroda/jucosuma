-- +goose Up
-- +goose StatementBegin
-- Imported bank statements. The bookings are private to the user who uploaded them: only their
-- classification (category, amount, month) may count for the household, never counterparty or purpose.
CREATE TABLE bank_imports
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id  INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    bank        TEXT    NOT NULL,
    filename    TEXT    NOT NULL,
    period_from DATE,
    period_to   DATE,
    imported    INTEGER NOT NULL DEFAULT 0,
    duplicates  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_transactions
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
    -- HOUSEHOLD: the classification counts for the household; PRIVATE: only in the owner's view
    scope             TEXT    NOT NULL DEFAULT 'PRIVATE' CHECK (scope IN ('HOUSEHOLD', 'PRIVATE')),
    kind              TEXT CHECK (kind IN ('EXPENSE', 'INCOME', 'TRANSFER')),
    category_id       INTEGER REFERENCES categories (id) ON DELETE SET NULL,
    contract_id       INTEGER REFERENCES contracts (id) ON DELETE SET NULL,
    classified_by     TEXT CHECK (classified_by IN ('RULE', 'MATCH', 'MANUAL', 'AI')),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- the same booking is stored once per account, even when two users upload the same export
    UNIQUE (account_id, fingerprint)
);
CREATE INDEX idx_bank_transactions_owner_date ON bank_transactions (owner_id, booking_date);
CREATE INDEX idx_bank_transactions_import ON bank_transactions (import_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE bank_transactions;
DROP TABLE bank_imports;
-- +goose StatementEnd
