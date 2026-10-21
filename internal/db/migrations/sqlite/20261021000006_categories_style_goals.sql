-- +goose Up
-- +goose StatementBegin
-- Categories: type (expense/income), colour slot (1-8 of the chart palette) and icon
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('EXPENSE', 'INCOME'));
ALTER TABLE categories ADD COLUMN color INTEGER;
ALTER TABLE categories ADD COLUMN icon TEXT;

UPDATE categories SET icon = 'home', color = 1 WHERE key = 'housing';
UPDATE categories SET icon = 'shopping-cart', color = 4 WHERE key = 'groceries';
UPDATE categories SET icon = 'film', color = 7 WHERE key = 'entertainment';
UPDATE categories SET icon = 'truck', color = 2 WHERE key = 'transport';
UPDATE categories SET icon = 'shield', color = 3 WHERE key = 'insurance';
UPDATE categories SET icon = 'cpu', color = 5 WHERE key = 'software';
UPDATE categories SET icon = 'ticket', color = 8 WHERE key = 'leisure';
UPDATE categories SET icon = 'bolt', color = 4 WHERE key = 'utilities';
UPDATE categories SET icon = 'wifi', color = 1 WHERE key = 'telecom';
UPDATE categories SET icon = 'academic-cap', color = 5 WHERE key = 'education';
UPDATE categories SET icon = 'heart', color = 8 WHERE key = 'health';
UPDATE categories SET icon = 'banknotes', color = 3 WHERE key = 'finance';
UPDATE categories SET icon = 'ellipsis' WHERE key = 'other';

INSERT INTO categories (name, sort_order, key, type, icon, color) VALUES
    ('Salary', 1, 'salary', 'INCOME', 'briefcase', 1),
    ('Bonus', 2, 'bonus', 'INCOME', 'gift', 4),
    ('Other income', 99, 'other_income', 'INCOME', 'ellipsis', NULL);

-- Accounts: optional IBAN (only the last digits are shown)
ALTER TABLE accounts ADD COLUMN iban TEXT;

-- Savings goals, funded by transfers that reference them
CREATE TABLE savings_goals
(
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    kind           TEXT    NOT NULL DEFAULT 'SAVING' CHECK (kind IN ('SAVING', 'INVESTING')),
    icon           TEXT,
    color          INTEGER,
    person_id      INTEGER REFERENCES persons (id) ON DELETE SET NULL,
    account_id     INTEGER REFERENCES accounts (id) ON DELETE SET NULL,
    target_amount  NUMERIC,
    target_date    DATE,
    current_amount NUMERIC,
    current_date   DATE,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at     DATETIME
);

ALTER TABLE contracts ADD COLUMN goal_id INTEGER REFERENCES savings_goals (id) ON DELETE SET NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN goal_id;
DROP TABLE savings_goals;
ALTER TABLE accounts DROP COLUMN iban;
DELETE FROM categories WHERE key IN ('salary', 'bonus', 'other_income');
ALTER TABLE categories DROP COLUMN icon;
ALTER TABLE categories DROP COLUMN color;
ALTER TABLE categories DROP COLUMN type;
-- +goose StatementEnd
