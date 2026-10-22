-- +goose Up
-- +goose StatementBegin
-- Explicit type of a transfer: SAVING (money set aside), WITHDRAWAL (back from the savings) or MOVE
-- (money only changes account or pot). NULL (older imports) is derived from the accounts.
ALTER TABLE contracts ADD COLUMN transfer_type TEXT CHECK (transfer_type IN ('SAVING', 'WITHDRAWAL', 'MOVE'));

-- so far the type followed from the accounts and the savings goal
UPDATE contracts
SET transfer_type = CASE
    WHEN COALESCE((SELECT a.is_savings FROM accounts a WHERE a.id = contracts.account_id), 0) = 1
        AND COALESCE((SELECT a.is_savings FROM accounts a WHERE a.id = contracts.target_account_id), 0) = 0
        THEN 'WITHDRAWAL'
    WHEN COALESCE((SELECT a.is_savings FROM accounts a WHERE a.id = contracts.account_id), 0) = 0
        AND (goal_id IS NOT NULL
            OR COALESCE((SELECT a.is_savings FROM accounts a WHERE a.id = contracts.target_account_id), 0) = 1)
        THEN 'SAVING'
    ELSE 'MOVE'
END
WHERE kind = 'TRANSFER';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN transfer_type;
-- +goose StatementEnd
