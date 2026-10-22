-- +goose Up
-- +goose StatementBegin
-- New goals always got sparkles in colour 3; without own choice the icon now follows the kind of the goal.
UPDATE savings_goals SET icon = NULL, color = NULL WHERE icon = 'sparkles' AND color = 3;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE savings_goals SET icon = 'sparkles', color = 3 WHERE icon IS NULL AND color IS NULL;
-- +goose StatementEnd
