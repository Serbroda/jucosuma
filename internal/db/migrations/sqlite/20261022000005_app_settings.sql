-- +goose Up
-- +goose StatementBegin
-- Settings of the whole installation, maintained by admins (e.g. database backups).
CREATE TABLE app_settings
(
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE app_settings;
-- +goose StatementEnd
