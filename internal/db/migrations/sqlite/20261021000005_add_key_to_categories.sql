-- +goose Up
-- +goose StatementBegin
-- Predefined categories get a stable key; the UI translates them by key.
-- Categories created by users keep key NULL and are shown by name.
ALTER TABLE categories ADD COLUMN key TEXT;
CREATE UNIQUE INDEX idx_categories_key ON categories (key) WHERE key IS NOT NULL;

UPDATE categories SET key = 'education' WHERE name = 'Education';
UPDATE categories SET key = 'entertainment' WHERE name = 'Entertainment';
UPDATE categories SET key = 'finance' WHERE name = 'Finance';
UPDATE categories SET key = 'health' WHERE name = 'Health & Fitness';
UPDATE categories SET key = 'housing' WHERE name = 'Housing & Rent';
UPDATE categories SET key = 'insurance' WHERE name = 'Insurance';
UPDATE categories SET key = 'software' WHERE name = 'Software & Services';
UPDATE categories SET key = 'telecom' WHERE name = 'Telecommunications & Internet';
UPDATE categories SET key = 'transport' WHERE name = 'Transportation';
UPDATE categories SET key = 'utilities' WHERE name = 'Utilities';
UPDATE categories SET key = 'other' WHERE name = 'Other';

-- Typical household categories
INSERT INTO categories (name, sort_order, key)
SELECT 'Groceries', 11, 'groceries' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Groceries');
INSERT INTO categories (name, sort_order, key)
SELECT 'Leisure', 12, 'leisure' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Leisure');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX idx_categories_key;
ALTER TABLE categories DROP COLUMN key;
-- +goose StatementEnd
