-- +goose Up
-- +goose StatementBegin
-- Amount changes of an entry over time (e.g. insurance increase, new grocery budget).
-- contracts.costs stays the amount from the start date; each row is the amount valid from valid_from on.
CREATE TABLE contract_amounts
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
    valid_from  DATE    NOT NULL,
    costs       REAL    NOT NULL,
    UNIQUE (contract_id, valid_from)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contract_amounts;
-- +goose StatementEnd
