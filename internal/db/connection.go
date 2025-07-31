package db

import "database/sql"

func OpenDB(dsn *string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", *dsn)
	if err != nil {
		return nil, err
	}

	if err = db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}
