package main

import (
	"flag"
	"github.com/Serbroda/contracts/internal/db"
	"github.com/Serbroda/contracts/internal/db/migrations"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	_ "github.com/glebarez/sqlite"
	"log"
	"net/http"
)

type application struct {
	queries *sqlc.Queries
}

func main() {
	addr := flag.String("addr", ":8080", "http service address")
	dsn := flag.String("dsn", "contracts.db", "sqlite data source name")
	flag.Parse()

	dbConn, err := db.OpenDB(dsn)
	if err != nil {
		panic(err)
	}
	defer dbConn.Close()

	db.Migrate(dbConn, "sqlite", migrations.MigrationsCommon, migrations.MigrationsCommonDir)

	app := application{
		queries: sqlc.New(dbConn),
	}

	log.Printf("Starting server on %s", *addr)

	err = http.ListenAndServe(*addr, app.routes())
	log.Fatalf("%+v\n", err)
}
