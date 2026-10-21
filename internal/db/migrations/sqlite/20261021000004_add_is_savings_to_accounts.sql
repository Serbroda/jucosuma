-- +goose Up
-- +goose StatementBegin
ALTER TABLE accounts ADD COLUMN is_savings INTEGER NOT NULL DEFAULT 0;
UPDATE accounts SET is_savings = 1 WHERE type IN ('SAVINGS', 'DEPOT');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE accounts DROP COLUMN is_savings;
-- +goose StatementEnd
