-- +goose Up
-- +goose StatementBegin
-- The palette grows from 8 to 16 colours: predefined categories get distinct default colours,
-- and "Memberships & dues" joins the predefined categories.
-- Only categories that still have their old default colour change; colours chosen by hand stay.
CREATE TEMP TABLE category_color (key TEXT, old_color INTEGER, new_color INTEGER);
INSERT INTO category_color VALUES
    ('telecom', 1, 9),
    ('health', 8, 5),
    ('pets', 2, 10),
    ('clothing', 7, 11),
    ('travel', 1, 15),
    ('gifts', 8, 16),
    ('finance', 3, 12),
    ('education', 5, 14),
    ('interest', 3, 6),
    ('benefits', 6, 13),
    ('side_income', 2, 9);
UPDATE categories
SET color      = (SELECT c.new_color FROM category_color c WHERE c.key = categories.key),
    updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM category_color c WHERE c.key = categories.key AND c.old_color = categories.color);
DROP TABLE category_color;

-- New predefined category for fixed dues: union, clubs, gym, broadcasting fee …
-- A custom category of that name (German or English) becomes the predefined one and keeps its entries.
UPDATE categories
SET key        = 'memberships',
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = (SELECT id FROM categories
            WHERE key IS NULL AND type = 'EXPENSE'
              AND lower(name) IN ('beiträge & mitgliedschaften', 'memberships & dues')
            ORDER BY deleted_at IS NOT NULL, id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM categories WHERE key = 'memberships');

INSERT INTO categories (name, key, type, icon, color, sort_order)
SELECT 'Memberships & Dues', 'memberships', 'EXPENSE', 'users', 13, 7
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE key = 'memberships')
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Memberships & Dues');

-- it goes right after "Subscriptions & streaming"
CREATE TEMP TABLE category_order (key TEXT, sort_order INTEGER);
INSERT INTO category_order VALUES
    ('memberships', 7), ('leisure', 8), ('health', 9), ('pets', 10), ('clothing', 11),
    ('travel', 12), ('gifts', 13), ('finance', 14), ('education', 15);
UPDATE categories SET sort_order = (SELECT o.sort_order FROM category_order o WHERE o.key = categories.key)
WHERE key IN (SELECT key FROM category_order);
DROP TABLE category_order;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM categories
WHERE key = 'memberships'
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.category_id = categories.id);
CREATE TEMP TABLE category_color (key TEXT, old_color INTEGER, new_color INTEGER);
INSERT INTO category_color VALUES
    ('telecom', 1, 9),
    ('health', 8, 5),
    ('pets', 2, 10),
    ('clothing', 7, 11),
    ('travel', 1, 15),
    ('gifts', 8, 16),
    ('finance', 3, 12),
    ('education', 5, 14),
    ('interest', 3, 6),
    ('benefits', 6, 13),
    ('side_income', 2, 9);
UPDATE categories
SET color = (SELECT c.old_color FROM category_color c WHERE c.key = categories.key)
WHERE EXISTS (SELECT 1 FROM category_color c WHERE c.key = categories.key AND c.new_color = categories.color);
-- colours above 8 do not exist before this migration
UPDATE categories SET color = NULL WHERE color > 8;
UPDATE accounts SET color = NULL WHERE color > 8;
UPDATE savings_goals SET color = NULL WHERE color > 8;
DROP TABLE category_color;
-- +goose StatementEnd
