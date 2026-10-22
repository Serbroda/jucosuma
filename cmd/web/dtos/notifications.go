package dtos

import (
	"encoding/json"
	"time"
)

// NotificationDto is a reminder in the bell.
type NotificationDto struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Link      *string   `json:"link"`
	CreatedAt time.Time `json:"created_at"`
	Read      bool      `json:"read"`
}

type NotificationListDto struct {
	Items  []NotificationDto `json:"items"`
	Unread int64             `json:"unread"`
}

// NotificationChannelDto is an external channel of the current user (ntfy, email, …).
type NotificationChannelDto struct {
	ID      int64           `json:"id"`
	Kind    string          `json:"kind"`
	Name    string          `json:"name"`
	Config  json.RawMessage `json:"config" tstype:"{ [key: string]: string }"`
	Enabled bool            `json:"enabled"`
}

type SaveNotificationChannelDto struct {
	Kind    string          `json:"kind"`
	Name    string          `json:"name" validate:"max=100"`
	Config  json.RawMessage `json:"config" tstype:"{ [key: string]: string }"`
	Enabled bool            `json:"enabled"`
}

// NotificationPreferenceDto tells whether a reminder type goes to a channel ("inapp" or a channel id).
type NotificationPreferenceDto struct {
	Type    string `json:"type"`
	Channel string `json:"channel"`
	Enabled bool   `json:"enabled"`
}

type NotificationKindDto struct {
	Kind      string `json:"kind"`
	Available bool   `json:"available"`
}

// NotificationSettingsDto is everything the personal notification settings page needs.
type NotificationSettingsDto struct {
	Types             []string                    `json:"types"`
	Kinds             []NotificationKindDto       `json:"kinds"`
	Channels          []NotificationChannelDto    `json:"channels"`
	Preferences       []NotificationPreferenceDto `json:"preferences"`
	DefaultNtfyServer string                      `json:"default_ntfy_server"`
}

// NotificationServerDto are the notification settings of the installation (admin). The SMTP
// password is never sent to the browser.
type NotificationServerDto struct {
	PublicURL    string `json:"public_url"`
	NtfyServer   string `json:"ntfy_server"`
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port"`
	SMTPUsername string `json:"smtp_username"`
	SMTPFrom     string `json:"smtp_from"`
	SMTPSecurity string `json:"smtp_security"`
	PasswordSet  bool   `json:"password_set"`
}

type SaveNotificationServerDto struct {
	PublicURL    string `json:"public_url"`
	NtfyServer   string `json:"ntfy_server"`
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port" validate:"min=0,max=65535"`
	SMTPUsername string `json:"smtp_username"`
	SMTPFrom     string `json:"smtp_from"`
	SMTPSecurity string `json:"smtp_security" validate:"omitempty,oneof=starttls tls none"`
	// SMTPPassword: empty keeps the stored password, ClearPassword removes it
	SMTPPassword  string `json:"smtp_password"`
	ClearPassword bool   `json:"clear_password"`
}
