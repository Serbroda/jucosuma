package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const backupPrefix = "jucosuma-"

// BackupConfig returns whether backups are enabled and how many daily backups to keep. It is
// read before every run, so changes (e.g. by an admin in the settings) apply without restart.
type BackupConfig func() (enabled bool, keep int)

// StartBackups writes a backup of the database into dir once a day and keeps the newest backups
// as configured. It checks every hour, so a missed day (server off) is caught up soon after start.
func StartBackups(db *sql.DB, dir string, config BackupConfig) {
	run := func() {
		enabled, keep := config()
		if !enabled {
			return
		}
		if path, err := BackupOnce(db, dir, keep, time.Now(), false); err != nil {
			log.Printf("Database backup failed: %v", err)
		} else if path != "" {
			log.Printf("Database backup written to %s", path)
		}
	}
	run()
	go func() {
		for range time.NewTicker(time.Hour).C {
			run()
		}
	}()
}

// BackupOnce writes today's backup (jucosuma-YYYY-MM-DD.db) unless it exists (force replaces it)
// and removes older backups beyond `keep`. VACUUM INTO produces a consistent copy while the app
// keeps running. It returns the path of a newly written backup, or "" if nothing was written.
func BackupOnce(db *sql.DB, dir string, keep int, now time.Time, force bool) (string, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	path := filepath.Join(dir, backupPrefix+now.Format("2006-01-02")+".db")
	written := ""
	if _, err := os.Stat(path); os.IsNotExist(err) || force {
		tmp := path + ".tmp"
		_ = os.Remove(tmp)
		if _, err := db.Exec("VACUUM INTO ?", tmp); err != nil {
			_ = os.Remove(tmp)
			return "", fmt.Errorf("vacuum into %s: %w", tmp, err)
		}
		_ = os.Remove(path)
		if err := os.Rename(tmp, path); err != nil {
			return "", fmt.Errorf("rename backup: %w", err)
		}
		// the backup contains everything, also private entries
		_ = os.Chmod(path, 0o600)
		written = path
	}
	return written, pruneBackups(dir, keep)
}

// BackupFile is an existing backup in the backup directory.
type BackupFile struct {
	Name    string
	Size    int64
	Created time.Time
}

// ListBackups returns the backups in dir, newest first. A missing directory means no backups.
func ListBackups(dir string) ([]BackupFile, error) {
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return []BackupFile{}, nil
	}
	if err != nil {
		return nil, err
	}
	backups := []BackupFile{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), backupPrefix) || !strings.HasSuffix(e.Name(), ".db") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			return nil, err
		}
		backups = append(backups, BackupFile{Name: e.Name(), Size: info.Size(), Created: info.ModTime()})
	}
	// names contain the date, so they sort chronologically
	sort.Slice(backups, func(i, j int) bool { return backups[i].Name > backups[j].Name })
	return backups, nil
}

// pruneBackups removes all but the newest `keep` backups.
func pruneBackups(dir string, keep int) error {
	backups, err := ListBackups(dir)
	if err != nil {
		return err
	}
	for i := keep; i < len(backups); i++ {
		if err := os.Remove(filepath.Join(dir, backups[i].Name)); err != nil {
			return err
		}
	}
	return nil
}
