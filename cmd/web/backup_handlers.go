package main

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	"github.com/Serbroda/contracts/internal/db"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/labstack/echo/v4"
)

const (
	settingBackupEnabled = "backup_enabled"
	settingBackupKeep    = "backup_keep"
)

// backupConfig returns the backup settings: saved by an admin, otherwise the flag/env defaults.
func (app *application) backupConfig() (bool, int) {
	ctx := context.Background()
	enabled := app.backupDefaultKeep > 0
	keep := app.backupDefaultKeep
	if keep <= 0 {
		keep = 14
	}
	if v, err := app.queries.FindAppSetting(ctx, settingBackupEnabled); err == nil {
		enabled = v == "true"
	}
	if v, err := app.queries.FindAppSetting(ctx, settingBackupKeep); err == nil {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			keep = n
		}
	}
	return enabled, keep
}

func (app *application) backupSettings() (dtos.BackupSettingsDto, error) {
	enabled, keep := app.backupConfig()
	files, err := db.ListBackups(app.backupDir)
	if err != nil {
		return dtos.BackupSettingsDto{}, err
	}
	result := dtos.BackupSettingsDto{Enabled: enabled, Keep: keep, Directory: app.backupDir, Backups: []dtos.BackupFileDto{}}
	for _, f := range files {
		result.Backups = append(result.Backups, dtos.BackupFileDto{Name: f.Name, Size: f.Size, Created: f.Created})
	}
	return result, nil
}

func (app *application) getBackupSettings(c echo.Context) error {
	settings, err := app.backupSettings()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, settings)
}

// saveBackupSettings stores the settings and applies them right away (today's backup, retention).
func (app *application) saveBackupSettings(c echo.Context) error {
	var payload dtos.SaveBackupSettingsDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	ctx := c.Request().Context()
	for key, value := range map[string]string{
		settingBackupEnabled: strconv.FormatBool(payload.Enabled),
		settingBackupKeep:    strconv.Itoa(payload.Keep),
	} {
		if err := app.queries.UpsertAppSetting(ctx, sqlc.UpsertAppSettingParams{Key: key, Value: value}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}
	if payload.Enabled {
		if _, err := db.BackupOnce(app.db, app.backupDir, payload.Keep, time.Now(), false); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "backup failed: "+err.Error())
		}
	}
	return app.getBackupSettings(c)
}

// runBackup writes (or replaces) today's backup immediately.
func (app *application) runBackup(c echo.Context) error {
	_, keep := app.backupConfig()
	if _, err := db.BackupOnce(app.db, app.backupDir, keep, time.Now(), true); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "backup failed: "+err.Error())
	}
	return app.getBackupSettings(c)
}

// backupFailed tells the admins (bell and their channels), once per day.
func (app *application) backupFailed(err error) {
	day := time.Now().Format("2006-01-02")
	app.notifyAdmins(context.Background(), func(t texts) reminder {
		return reminder{Type: reminderBackupFailed, Key: "backup:" + day, Title: t.f("backupTitle"), Body: t.f("backupBody", err.Error()), Link: "/settings"}
	})
}
