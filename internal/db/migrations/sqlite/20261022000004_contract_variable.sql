-- +goose Up
-- +goose StatementBegin
-- Explicit cost type of expenses: fixed (incl. contracts) or variable (budget, e.g. groceries, fuel).
ALTER TABLE contracts ADD COLUMN is_variable INTEGER NOT NULL DEFAULT 0;

-- so far every expense that is not a contract counted as variable
UPDATE contracts SET is_variable = 1 WHERE kind = 'EXPENSE' AND is_contract = 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN is_variable;
-- +goose StatementEnd
