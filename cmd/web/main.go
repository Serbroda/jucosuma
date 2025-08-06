package main

import (
	"database/sql"
	"flag"
	"log"

	"github.com/Serbroda/contracts/internal/db"
	"github.com/Serbroda/contracts/internal/db/migrations"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	_ "github.com/glebarez/sqlite"
)

type application struct {
	db         *sql.DB
	queries    *sqlc.Queries
	uploadsDir string
}

func main() {
	addr := flag.String("addr", ":8080", "http service address")
	dbPath := flag.String("db-path", "contracts.db", "sqlite data source name")
	uploadsDir := flag.String("uploads-dir", "./uploads", "uploads directory")
	flag.Parse()

	dbConn, err := db.OpenDB(dbPath)
	if err != nil {
		panic(err)
	}
	defer dbConn.Close()

	db.Migrate(dbConn, "sqlite", migrations.MigrationsCommon, migrations.MigrationsCommonDir)

	app := application{
		db:         dbConn,
		queries:    sqlc.New(dbConn),
		uploadsDir: *uploadsDir,
	}

	e := app.routes()

	log.Printf("Starting server on %s", *addr)

	e.Logger.Fatal(e.Start(*addr))
}
