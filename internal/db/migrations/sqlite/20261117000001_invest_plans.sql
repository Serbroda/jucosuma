-- +goose Up
-- +goose StatementBegin
-- Invest plans are private to the user who created them: a monthly amount that is spread over
-- positions (ETF, call money, …) by percentage or as a fixed amount. They are plans only and
-- create no entries.
CREATE TABLE invest_plans
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    amount     NUMERIC NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_invest_plans_owner ON invest_plans (owner_id);

-- A FIXED position takes its value as amount, PERCENT positions share what the fixed ones leave.
CREATE TABLE invest_plan_items
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id    INTEGER NOT NULL REFERENCES invest_plans (id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    mode       TEXT    NOT NULL DEFAULT 'PERCENT' CHECK (mode IN ('PERCENT', 'FIXED')),
    value      NUMERIC NOT NULL DEFAULT 0,
    account_id INTEGER REFERENCES accounts (id) ON DELETE SET NULL, -- where the money goes (optional)
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_invest_plan_items_plan ON invest_plan_items (plan_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE invest_plan_items;
DROP TABLE invest_plans;
-- +goose StatementEnd
