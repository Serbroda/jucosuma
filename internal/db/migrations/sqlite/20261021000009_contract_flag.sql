-- +goose Up
-- +goose StatementBegin
-- Explicit flag for entries shown on the contracts page.
ALTER TABLE contracts ADD COLUMN is_contract INTEGER NOT NULL DEFAULT 0;

-- keep what was shown so far: recurring expenses with provider, numbers or term data
UPDATE contracts
SET is_contract = 1
WHERE kind = 'EXPENSE'
  AND billing_period NOT IN ('NONE', 'ONE_TIME')
  AND (coalesce(company, '') != '' OR coalesce(contract_number, '') != '' OR coalesce(customer_number, '') != ''
    OR term_months IS NOT NULL OR notice_period IS NOT NULL);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN is_contract;
-- +goose StatementEnd
