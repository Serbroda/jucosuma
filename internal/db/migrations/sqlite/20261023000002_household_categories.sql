-- +goose Up
-- +goose StatementBegin
-- Predefined categories for a household budget book.
-- Merges overlapping categories, adds typical household ones and retires unused vague ones.
-- Only predefined categories (with key) are touched; renamed or custom ones stay as they are.
-- The English name is only the fallback; the UI translates predefined categories by key.

-- 1) "Utilities" merges into "Housing" (housing & energy), "Software" into "Entertainment"
--    (which becomes "Subscriptions & streaming").
UPDATE categories SET key = 'subscriptions' WHERE key = 'entertainment';

CREATE TEMP TABLE category_merge (old_key TEXT, new_key TEXT);
INSERT INTO category_merge VALUES ('utilities', 'housing'), ('software', 'subscriptions');

-- entries move over (with the readable name copy)
UPDATE contracts
SET category_id = (SELECT n.id FROM category_merge m
                   JOIN categories o ON o.key = m.old_key
                   JOIN categories n ON n.key = m.new_key
                   WHERE o.id = contracts.category_id),
    updated_at  = CURRENT_TIMESTAMP
WHERE category_id IN (SELECT o.id FROM category_merge m
                      JOIN categories o ON o.key = m.old_key
                      JOIN categories n ON n.key = m.new_key);

-- actual amounts of month closings add up in the merged category
INSERT INTO month_closing_actuals (closing_id, category_id, amount)
SELECT a.closing_id, n.id, a.amount
FROM month_closing_actuals a
JOIN categories o ON o.id = a.category_id
JOIN category_merge m ON m.old_key = o.key
JOIN categories n ON n.key = m.new_key
WHERE true
ON CONFLICT (closing_id, category_id) DO UPDATE SET amount = amount + excluded.amount;

DELETE FROM month_closing_actuals
WHERE category_id IN (SELECT o.id FROM category_merge m
                      JOIN categories o ON o.key = m.old_key
                      JOIN categories n ON n.key = m.new_key);

UPDATE categories SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND key IN (SELECT m.old_key FROM category_merge m JOIN categories n ON n.key = m.new_key);

DROP TABLE category_merge;

-- 2) "Education" and "Finance" are retired when nothing uses them
UPDATE categories SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND key IN ('education', 'finance')
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.category_id = categories.id AND c.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM month_closing_actuals a WHERE a.category_id = categories.id);

-- 3) New fallback names of the predefined categories (skipped if a category of that name exists)
CREATE TEMP TABLE category_names (key TEXT, name TEXT);
INSERT INTO category_names VALUES
    ('housing', 'Housing & Energy'),
    ('groceries', 'Groceries & Drugstore'),
    ('subscriptions', 'Subscriptions & Streaming'),
    ('leisure', 'Leisure & Restaurants'),
    ('health', 'Health');
UPDATE categories
SET name       = (SELECT n.name FROM category_names n WHERE n.key = categories.key),
    updated_at = CURRENT_TIMESTAMP
WHERE key IN (SELECT key FROM category_names)
  AND NOT EXISTS (SELECT 1 FROM categories x JOIN category_names n ON n.name = x.name
                  WHERE n.key = categories.key AND x.id <> categories.id);
DROP TABLE category_names;

UPDATE contracts SET category = (SELECT k.name FROM categories k WHERE k.id = contracts.category_id)
WHERE category_id IN (SELECT id FROM categories WHERE key IS NOT NULL);

-- 4) New categories. A custom category of the same name becomes the predefined one.
CREATE TEMP TABLE category_new (key TEXT, name TEXT, type TEXT, icon TEXT, color INTEGER);
INSERT INTO category_new VALUES
    ('pets', 'Pets', 'EXPENSE', 'heart', 2),
    ('clothing', 'Clothing', 'EXPENSE', 'shopping-bag', 7),
    ('travel', 'Holidays & Travel', 'EXPENSE', 'plane', 1),
    ('gifts', 'Gifts & Donations', 'EXPENSE', 'gift', 8),
    ('interest', 'Interest & Dividends', 'INCOME', 'chart', 3),
    ('benefits', 'Child Benefit & Allowances', 'INCOME', 'banknotes', 6),
    ('side_income', 'Side Income', 'INCOME', 'tools', 2);

UPDATE categories
SET key        = (SELECT n.key FROM category_new n WHERE n.name = categories.name),
    deleted_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE key IS NULL
  AND name IN (SELECT name FROM category_new)
  AND NOT EXISTS (SELECT 1 FROM categories k JOIN category_new n ON n.key = k.key WHERE n.name = categories.name);

INSERT INTO categories (name, key, type, icon, color, sort_order)
SELECT n.name, n.key, n.type, n.icon, n.color, 0
FROM category_new n
WHERE NOT EXISTS (SELECT 1 FROM categories k WHERE k.key = n.key)
  AND NOT EXISTS (SELECT 1 FROM categories k WHERE k.name = n.name);
DROP TABLE category_new;

-- 5) Order of the predefined categories (custom ones keep theirs)
CREATE TEMP TABLE category_order (key TEXT, sort_order INTEGER);
INSERT INTO category_order VALUES
    ('housing', 1), ('groceries', 2), ('transport', 3), ('insurance', 4), ('telecom', 5),
    ('subscriptions', 6), ('leisure', 7), ('health', 8), ('pets', 9), ('clothing', 10),
    ('travel', 11), ('gifts', 12), ('finance', 13), ('education', 14), ('other', 99),
    ('salary', 1), ('bonus', 2), ('interest', 3), ('benefits', 4), ('side_income', 5), ('other_income', 99);
UPDATE categories SET sort_order = (SELECT o.sort_order FROM category_order o WHERE o.key = categories.key)
WHERE key IN (SELECT key FROM category_order);
DROP TABLE category_order;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Merged categories cannot be split again; only the added, unused categories are removed.
DELETE FROM categories
WHERE key IN ('pets', 'clothing', 'travel', 'gifts', 'interest', 'benefits', 'side_income')
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.category_id = categories.id);
-- +goose StatementEnd
