-- +goose Up
-- +goose StatementBegin
-- An import is worked through and then closed; bookings without category count as "not assigned".
-- Some months after closing, the raw details (counterparty, purpose, …) are removed: date, amount,
-- classification and the fingerprint against duplicates stay.
ALTER TABLE bank_imports ADD COLUMN closed_at DATETIME;
ALTER TABLE bank_imports ADD COLUMN purged_at DATETIME;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE bank_imports DROP COLUMN purged_at;
ALTER TABLE bank_imports DROP COLUMN closed_at;
-- +goose StatementEnd
