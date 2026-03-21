-- +goose Up
-- +goose StatementBegin
ALTER TABLE contracts ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN owner_id;
-- +goose StatementEnd
