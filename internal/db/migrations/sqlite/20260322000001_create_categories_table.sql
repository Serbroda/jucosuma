-- +goose Up
-- +goose StatementBegin
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

INSERT INTO categories (name, sort_order) VALUES
    ('Education', 1),
    ('Entertainment', 2),
    ('Finance', 3),
    ('Health & Fitness', 4),
    ('Housing & Rent', 5),
    ('Insurance', 6),
    ('Software & Services', 7),
    ('Telecommunications & Internet', 8),
    ('Transportation', 9),
    ('Utilities', 10),
    ('Other', 99);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE categories;
-- +goose StatementEnd
