package main

import (
	"context"
	"strconv"

	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/notify"
)

// keys of the notification settings of the installation in app_settings
const (
	settingPublicURL    = "public_url"
	settingNtfyServer   = "ntfy_server"
	settingSMTPHost     = "smtp_host"
	settingSMTPPort     = "smtp_port"
	settingSMTPUsername = "smtp_username"
	settingSMTPPassword = "smtp_password"
	settingSMTPFrom     = "smtp_from"
	settingSMTPSecurity = "smtp_security"
)

func (app *application) setting(ctx context.Context, key, fallback string) string {
	if v, err := app.queries.FindAppSetting(ctx, key); err == nil {
		return v
	}
	return fallback
}

func (app *application) saveSetting(ctx context.Context, key, value string) error {
	return app.queries.UpsertAppSetting(ctx, sqlc.UpsertAppSettingParams{Key: key, Value: value})
}

// notifyServer reads the notification settings of the installation.
func (app *application) notifyServer(ctx context.Context) notify.Server {
	port, _ := strconv.Atoi(app.setting(ctx, settingSMTPPort, "587"))
	return notify.Server{
		PublicURL:  app.setting(ctx, settingPublicURL, ""),
		NtfyServer: app.setting(ctx, settingNtfyServer, "https://ntfy.sh"),
		SMTP: notify.SMTPSettings{
			Host:     app.setting(ctx, settingSMTPHost, ""),
			Port:     port,
			Username: app.setting(ctx, settingSMTPUsername, ""),
			Password: app.setting(ctx, settingSMTPPassword, ""),
			From:     app.setting(ctx, settingSMTPFrom, ""),
			Security: app.setting(ctx, settingSMTPSecurity, "starttls"),
		},
	}
}
