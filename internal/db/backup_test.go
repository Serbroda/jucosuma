package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

func names(t *testing.T, dir string) []string {
	t.Helper()
	list, err := ListBackups(dir)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, b := range list {
		out = append(out, b.Name)
	}
	return out
}

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
	day := time.Date(2026, 10, 22, 9, 30, 0, 0, time.Local)

	// first backup: name with time, complete and readable
	path, err := BackupOnce(conn, backups, 3, day, false)
	if err != nil || filepath.Base(path) != "jucosuma-2026-10-22-093000.db" {
		t.Fatalf("first backup: %q, %v", path, err)
	}
	copyDB, _ := sql.Open("sqlite", path)
	var n int
	if err := copyDB.QueryRow("SELECT count(*) FROM t").Scan(&n); err != nil || n != 2 {
		t.Fatalf("rows in backup = %d, %v", n, err)
	}
	copyDB.Close()

	// same day: no second daily backup …
	if path, _ := BackupOnce(conn, backups, 3, day.Add(time.Hour), false); path != "" {
		t.Fatalf("second daily backup on the same day: %q", path)
	}
	// … but "back up now" always writes a new one
	if path, _ := BackupOnce(conn, backups, 3, day.Add(2*time.Hour), true); filepath.Base(path) != "jucosuma-2026-10-22-113000.db" {
		t.Fatalf("forced backup: %q", path)
	}

	// next days without changes: nothing new, older states stay
	for i := 1; i <= 21; i++ {
		if path, err := BackupOnce(conn, backups, 3, day.AddDate(0, 0, i), false); err != nil || path != "" {
			t.Fatalf("unchanged day %d: %q, %v", i, path, err)
		}
	}
	if got := names(t, backups); len(got) != 2 {
		t.Fatalf("after a break: %v", got)
	}

	// changed data: new backup, retention keeps the newest three
	for i, v := range []string{"c", "d"} {
		if _, err := conn.Exec("INSERT INTO t VALUES (?)", v); err != nil {
			t.Fatal(err)
		}
		if path, err := BackupOnce(conn, backups, 3, day.AddDate(0, 0, 22+i), false); err != nil || path == "" {
			t.Fatalf("changed day: %q, %v", path, err)
		}
	}
	want := []string{"jucosuma-2026-11-14-093000.db", "jucosuma-2026-11-13-093000.db", "jucosuma-2026-10-22-113000.db"}
	got := names(t, backups)
	if len(got) != len(want) {
		t.Fatalf("backups = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("backups = %v, want %v", got, want)
		}
	}
}

func TestListBackupsOldNames(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"jucosuma-2026-10-20.db", "jucosuma-2026-10-21-080000.db", "jucosuma-2026-10-20-230000.db", "other.db"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	got := names(t, dir)
	want := []string{"jucosuma-2026-10-21-080000.db", "jucosuma-2026-10-20-230000.db", "jucosuma-2026-10-20.db"}
	for i := range want {
		if len(got) != len(want) || got[i] != want[i] {
			t.Fatalf("order = %v, want %v", got, want)
		}
	}
}
