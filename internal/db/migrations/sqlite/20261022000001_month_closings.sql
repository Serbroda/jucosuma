-- +goose Up
-- +goose StatementBegin
-- A monthly closing records the real account balances at the end of a month and, optionally,
-- the actual totals of variable cost categories, to compare plan and reality.
CREATE TABLE month_closings
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    month      TEXT NOT NULL UNIQUE, -- YYYY-MM
    notes      TEXT,
    created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE month_closing_balances
(
    closing_id INTEGER NOT NULL REFERENCES month_closings (id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    balance    NUMERIC NOT NULL,
    PRIMARY KEY (closing_id, account_id)
);

CREATE TABLE month_closing_actuals
(
    closing_id  INTEGER NOT NULL REFERENCES month_closings (id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    amount      NUMERIC NOT NULL,
    PRIMARY KEY (closing_id, category_id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE month_closing_actuals;
DROP TABLE month_closing_balances;
DROP TABLE month_closings;
-- +goose StatementEnd
