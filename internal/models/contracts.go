package models

import "database/sql"

type Contract struct {
	ID        int
	Name      string
	CreatedAt string
	UpdatedAt string
	DeletedAt string
}

type ContractModel struct {
	DB *sql.DB
}

func (m *ContractModel) Insert(name string) (int, error) {
	stmt := `INSERT INTO contracts (name) 
	VALUES(?)`

	result, err := m.DB.Exec(stmt, name)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return int(id), nil
}
