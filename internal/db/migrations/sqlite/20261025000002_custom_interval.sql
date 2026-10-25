-- +goose Up
-- +goose StatementBegin
-- Custom interval of an entry ("every 6 weeks"). When set it replaces billing_period, which then
-- keeps a valid value (MONTHLY) because its CHECK constraint can't be changed without rebuilding the table.
ALTER TABLE contracts ADD COLUMN interval_count INTEGER;
ALTER TABLE contracts ADD COLUMN interval_unit TEXT CHECK (interval_unit IN ('DAYS', 'WEEKS', 'MONTHS', 'YEARS'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN interval_unit;
ALTER TABLE contracts DROP COLUMN interval_count;
-- +goose StatementEnd
