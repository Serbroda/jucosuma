-- +goose Up
-- +goose StatementBegin
-- Contract term (renews automatically by this many months) and notice period
ALTER TABLE contracts ADD COLUMN term_months INTEGER;
ALTER TABLE contracts ADD COLUMN notice_period INTEGER;
ALTER TABLE contracts ADD COLUMN notice_unit TEXT CHECK (notice_unit IN ('DAYS', 'WEEKS', 'MONTHS'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN notice_unit;
ALTER TABLE contracts DROP COLUMN notice_period;
ALTER TABLE contracts DROP COLUMN term_months;
-- +goose StatementEnd
