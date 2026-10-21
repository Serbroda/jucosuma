-- +goose Up
-- +goose StatementBegin
ALTER TABLE accounts ADD COLUMN balance NUMERIC;
ALTER TABLE accounts ADD COLUMN balance_date DATE;
ALTER TABLE accounts ADD COLUMN goal_amount NUMERIC;
ALTER TABLE accounts ADD COLUMN goal_date DATE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE accounts DROP COLUMN goal_date;
ALTER TABLE accounts DROP COLUMN goal_amount;
ALTER TABLE accounts DROP COLUMN balance_date;
ALTER TABLE accounts DROP COLUMN balance;
-- +goose StatementEnd
