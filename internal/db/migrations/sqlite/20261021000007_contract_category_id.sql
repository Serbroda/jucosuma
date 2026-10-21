-- +goose Up
-- +goose StatementBegin
-- Entries reference their category by id instead of by name.
-- The old "category" column stays as a readable copy of the name.
ALTER TABLE contracts ADD COLUMN category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL;

-- Restore deleted categories that are still used by entries ...
UPDATE categories
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL
  AND lower(name) IN (SELECT lower(category) FROM contracts WHERE deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM categories a WHERE a.deleted_at IS NULL AND lower(a.name) = lower(categories.name));

-- ... and create categories for names that never existed (e.g. the old default 'OTHER' is matched case-insensitively)
INSERT OR IGNORE INTO categories (name, sort_order, type)
SELECT category, 90, CASE WHEN min(kind) = 'INCOME' THEN 'INCOME' ELSE 'EXPENSE' END
FROM contracts
WHERE deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM categories k WHERE k.deleted_at IS NULL AND lower(k.name) = lower(contracts.category))
GROUP BY lower(category);

UPDATE contracts
SET category_id = (SELECT k.id FROM categories k
                   WHERE k.deleted_at IS NULL AND lower(k.name) = lower(contracts.category)
                   ORDER BY k.id LIMIT 1);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE contracts DROP COLUMN category_id;
-- +goose StatementEnd
