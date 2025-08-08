-- +goose Up
-- +goose StatementBegin
CREATE TABLE contracts
(
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    company            TEXT,
    contract_type      TEXT NOT NULL DEFAULT 'CONTRACT',
    category           TEXT NOT NULL DEFAULT 'OTHER',
    start_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date           DATE,
    contract_number    TEXT,
    customer_number    TEXT,
    contract_holder_id INTEGER,
    costs              NUMERIC       DEFAULT 0.0,
    billing_period     TEXT NOT NULL DEFAULT 'WEEKLY',
    contact_person     TEXT,
    contact_address    TEXT,
    contact_phone      TEXT,
    contact_email      TEXT,
    icon_source        TEXT,
    notes              TEXT,
    created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
    deleted_at         DATETIME,
    CONSTRAINT fk_contracts_contract_holder_id FOREIGN KEY (contract_holder_id) REFERENCES users (id)

);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contracts;
-- +goose StatementEnd
