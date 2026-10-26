-- +goose Up
-- +goose StatementBegin
-- A share is either a weight (part of what is left) or a fixed amount per payment, e.g. a brother
-- paying 10 € of a family plan. The table is rebuilt to relax the weight CHECK; nothing references it.
CREATE TABLE contract_shares_new
(
    contract_id INTEGER NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
    person_id   INTEGER NOT NULL REFERENCES persons (id) ON DELETE CASCADE,
    weight      REAL    NOT NULL DEFAULT 0 CHECK (weight >= 0),
    amount      REAL CHECK (amount >= 0),
    PRIMARY KEY (contract_id, person_id),
    CHECK (weight > 0 OR amount IS NOT NULL)
);
INSERT INTO contract_shares_new (contract_id, person_id, weight)
SELECT contract_id, person_id, weight FROM contract_shares;
DROP TABLE contract_shares;
ALTER TABLE contract_shares_new RENAME TO contract_shares;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- fixed amounts become plain equal shares
CREATE TABLE contract_shares_old
(
    contract_id INTEGER NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
    person_id   INTEGER NOT NULL REFERENCES persons (id) ON DELETE CASCADE,
    weight      REAL    NOT NULL CHECK (weight > 0),
    PRIMARY KEY (contract_id, person_id)
);
INSERT INTO contract_shares_old (contract_id, person_id, weight)
SELECT contract_id, person_id, CASE WHEN weight > 0 THEN weight ELSE 1 END FROM contract_shares;
DROP TABLE contract_shares;
ALTER TABLE contract_shares_old RENAME TO contract_shares;
-- +goose StatementEnd
