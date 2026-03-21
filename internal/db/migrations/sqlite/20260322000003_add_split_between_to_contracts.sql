-- +goose Up
-- +goose StatementBegin
ALTER TABLE contracts ADD COLUMN split_between INTEGER NOT NULL DEFAULT 1;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN split_between;
-- +goose StatementEnd
