-- +goose Up
-- +goose StatementBegin
-- Optional icon and colour slot per account; without them the icon follows the account type.
ALTER TABLE accounts ADD COLUMN icon TEXT;
ALTER TABLE accounts ADD COLUMN color INTEGER;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE accounts DROP COLUMN color;
ALTER TABLE accounts DROP COLUMN icon;
-- +goose StatementEnd
