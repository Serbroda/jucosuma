-- +goose Up
-- +goose StatementBegin
CREATE TABLE contracts
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    company     TEXT,
    category    TEXT NOT NULL DEFAULT 'OTHER',
    costs       NUMERIC       DEFAULT 0.0,
    icon_source TEXT,
    created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
    deleted_at  DATETIME
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contracts;
-- +goose StatementEnd
