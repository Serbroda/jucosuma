package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strconv"

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
	// backups: directory and the default retention from flag/env (0 = disabled by default)
	backupDir         string
	backupDefaultKeep int
}

func main() {
	// unknown to Go's type table; browsers expect the manifest of the web app with this type
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")

	versionFlag := flag.Bool("version", false, "show program version")
	flag.BoolVar(versionFlag, "v", false, "shorthand for --version")

	addr := flag.String("addr", utils.GetEnv("ADDR", ":8080"), "http service address")
	dbPath := flag.String("db-path", utils.GetEnv("DB_PATH", "jucosuma.db"), "sqlite data source")
	uploadsDir := flag.String("uploads-dir", utils.GetEnv("UPLOADS_DIR", "./uploads"), "uploads directory")
	backupDir := flag.String("backup-dir", utils.GetEnv("BACKUP_DIR", ""), "directory for daily database backups (default: backups next to the database)")
	backupKeep := flag.Int("backup-keep", backupKeepDefault(), "number of backups to keep, 0 disables backups (admins can change both in the settings)")
	flag.Parse()
	if *backupDir == "" {
		*backupDir = filepath.Join(filepath.Dir(*dbPath), "backups")
	}

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
		db:                dbConn,
		queries:           sqlc.New(dbConn),
		uploadsDir:        *uploadsDir,
		backupDir:         *backupDir,
		backupDefaultKeep: *backupKeep,
	}
	db.StartBackups(dbConn, app.backupDir, app.backupConfig, app.backupFailed)
	app.StartReminders()

	if err := app.seedAdmin("admin_password.txt"); err != nil {
		log.Fatalf("Failed to seed admin: %v", err)
	}

	e := app.routes()

	log.Printf("Starting server on %s", *addr)

	e.Logger.Fatal(e.Start(*addr))
}

// backupKeepDefault reads BACKUP_KEEP (number of daily backups), default 14.
func backupKeepDefault() int {
	if n, err := strconv.Atoi(utils.GetEnv("BACKUP_KEEP", "14")); err == nil {
		return n
	}
	return 14
}
