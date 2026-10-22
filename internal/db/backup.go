package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
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

// StartBackups writes a backup of the database into dir once a day (if the data changed) and
// keeps the newest backups as configured. It checks every hour, so a missed day (server off) is
// caught up soon after start. onError is called when a backup fails (e.g. to notify admins).
func StartBackups(db *sql.DB, dir string, config BackupConfig, onError func(error)) {
	run := func() {
		enabled, keep := config()
		if !enabled {
			return
		}
		if path, err := BackupOnce(db, dir, keep, time.Now(), false); err != nil {
			log.Printf("Database backup failed: %v", err)
			if onError != nil {
				onError(err)
			}
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

// BackupOnce writes a backup (jucosuma-YYYY-MM-DD-HHMMSS.db) and keeps the newest `keep` backups.
// Without force it writes at most one backup per day and only if the data changed since the
// newest backup – so a longer break does not push older, different states out of the retention.
// force ("back up now") always writes a new backup. VACUUM INTO produces a consistent copy while
// the app keeps running. It returns the path of a newly written backup, or "" if nothing was written.
func BackupOnce(db *sql.DB, dir string, keep int, now time.Time, force bool) (string, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	existing, err := ListBackups(dir)
	if err != nil {
		return "", err
	}
	if !force && len(existing) > 0 && sameDay(existing[0].Created, now) {
		return "", nil // today's backup exists
	}

	path := filepath.Join(dir, backupPrefix+now.Format(backupTimeFormat)+".db")
	tmp := path + ".tmp"
	_ = os.Remove(tmp)
	if _, err := db.Exec("VACUUM INTO ?", tmp); err != nil {
		_ = os.Remove(tmp)
		return "", fmt.Errorf("vacuum into %s: %w", tmp, err)
	}
	if !force && len(existing) > 0 {
		if same, err := sameContent(tmp, filepath.Join(dir, existing[0].Name)); err == nil && same {
			_ = os.Remove(tmp)
			return "", nil // nothing changed since the newest backup
		}
	}
	_ = os.Remove(path)
	if err := os.Rename(tmp, path); err != nil {
		return "", fmt.Errorf("rename backup: %w", err)
	}
	// the backup contains everything, also private entries
	_ = os.Chmod(path, 0o600)
	return path, pruneBackups(dir, keep)
}

const backupTimeFormat = "2006-01-02-150405"

// backupTime reads the time from a backup name; older backups have only the date.
func backupTime(name string) (time.Time, bool) {
	stamp := strings.TrimSuffix(strings.TrimPrefix(name, backupPrefix), ".db")
	for _, layout := range []string{backupTimeFormat, "2006-01-02"} {
		if t, err := time.ParseInLocation(layout, stamp, time.Local); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func sameDay(a, b time.Time) bool {
	return a.Year() == b.Year() && a.YearDay() == b.YearDay()
}

// sameContent compares two files byte by byte (via SHA-256).
func sameContent(a, b string) (bool, error) {
	ha, err := fileHash(a)
	if err != nil {
		return false, err
	}
	hb, err := fileHash(b)
	if err != nil {
		return false, err
	}
	return ha == hb, nil
}

func fileHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
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
		created, ok := backupTime(e.Name())
		if !ok {
			continue
		}
		info, err := e.Info()
		if err != nil {
			return nil, err
		}
		backups = append(backups, BackupFile{Name: e.Name(), Size: info.Size(), Created: created})
	}
	sort.Slice(backups, func(i, j int) bool { return backups[i].Created.After(backups[j].Created) })
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
