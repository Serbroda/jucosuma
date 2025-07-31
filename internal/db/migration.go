package db

import (
	"database/sql"
	"embed"

	"github.com/pressly/goose/v3"
)

func Migrate(db *sql.DB, dialect string, migrations embed.FS, migrationsDir string) {
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect(dialect); err != nil {
		panic(err)
	}

	if err := goose.Up(db, migrationsDir); err != nil {
		panic(err)
	}
}
