package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/Serbroda/contracts/internal/db"
	"github.com/Serbroda/contracts/internal/db/migrations"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/utils"
	_ "github.com/glebarez/sqlite"
)

var Version = "dev" // Default-Wert

type application struct {
	db         *sql.DB
	queries    *sqlc.Queries
	uploadsDir string
}

func main() {
	versionFlag := flag.Bool("version", false, "show program version")
	flag.BoolVar(versionFlag, "v", false, "shorthand for --version")

	addr := flag.String("addr", utils.GetEnv("ADDR", ":8080"), "http service address")
	dbPath := flag.String("db-path", utils.GetEnv("DB_PATH", "jucosuma.db"), "sqlite data source")
	uploadsDir := flag.String("uploads-dir", utils.GetEnv("UPLOADS_DIR", "./uploads"), "uploads directory")
	flag.Parse()

	if *versionFlag {
		fmt.Println(Version)
		os.Exit(0)
	}

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
