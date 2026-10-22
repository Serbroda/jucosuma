package db

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

func TestBackupOnce(t *testing.T) {
	dir := t.TempDir()
	dsn := filepath.Join(dir, "app.db")
	conn, err := OpenDB(&dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if _, err := conn.Exec("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('a'), ('b')"); err != nil {
		t.Fatal(err)
	}

	backups := filepath.Join(dir, "backups")
	day := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	path, err := BackupOnce(conn, backups, 3, day, false)
	if err != nil || path == "" {
		t.Fatalf("first backup: %q, %v", path, err)
	}

	// the backup is a complete, readable database
	copyDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	var n int
	if err := copyDB.QueryRow("SELECT count(*) FROM t").Scan(&n); err != nil || n != 2 {
		t.Fatalf("rows in backup = %d, %v", n, err)
	}
	copyDB.Close()

	// same day: nothing new
	if path, err := BackupOnce(conn, backups, 3, day.Add(time.Hour), false); err != nil || path != "" {
		t.Fatalf("second backup on the same day: %q, %v", path, err)
	}

	// forced (e.g. "back up now"): today's backup is replaced
	if path, err := BackupOnce(conn, backups, 3, day.Add(2*time.Hour), true); err != nil || path == "" {
		t.Fatalf("forced backup: %q, %v", path, err)
	}

	// five days -> only the newest three remain
	for i := 1; i <= 4; i++ {
		if _, err := BackupOnce(conn, backups, 3, day.AddDate(0, 0, i), false); err != nil {
			t.Fatal(err)
		}
	}
	list, err := ListBackups(backups)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, b := range list {
		names = append(names, b.Name)
	}
	want := []string{"jucosuma-2026-10-26.db", "jucosuma-2026-10-25.db", "jucosuma-2026-10-24.db"}
	if len(names) != len(want) {
		t.Fatalf("backups = %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("backups = %v, want %v", names, want)
		}
	}
}
