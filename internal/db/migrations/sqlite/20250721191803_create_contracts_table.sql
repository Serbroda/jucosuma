-- +goose Up
-- +goose StatementBegin
CREATE TABLE contracts
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    company           TEXT,
    category          TEXT NOT NULL DEFAULT 'OTHER',
    start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date          DATE,
    contract_number   TEXT,
    customer_number   TEXT,
    contract_holder   TEXT,
    billing_period    TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (billing_period IN (
                                                                               'NONE', 'ONE_TIME', 'WEEKLY', 'MONTHLY',
                                                                               'QUARTERLY',
                                                                               'SEMIANNUALLY', 'ANNUALLY',
                                                                               'EVERY_TWO_YEARS'
        )),
    costs             NUMERIC,
    currency          TEXT          DEFAULT 'EUR',
    next_billing_date DATE,
    contact_person    TEXT,
    contact_address   TEXT,
    contact_phone     TEXT,
    contact_email     TEXT,
    icon_source       TEXT,
    notes             TEXT,
    created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
    deleted_at        DATETIME

);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE contracts;
-- +goose StatementEnd
