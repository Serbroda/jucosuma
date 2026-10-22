package main

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
	"github.com/Serbroda/contracts/internal/notify"
	"github.com/labstack/echo/v4"
)

func currentUser(c echo.Context) sqlc.User {
	return c.Get("user").(sqlc.User)
}

// getNotifications returns the bell of the current user. It also remembers the browser language,
// used for texts sent by the server when the user has not chosen a language.
func (app *application) getNotifications(c echo.Context) error {
	ctx := c.Request().Context()
	user := currentUser(c)
	if lang := browserLanguage(c.Request().Header.Get("Accept-Language")); lang != "" {
		_ = app.queries.UpsertNotificationLanguage(ctx, sqlc.UpsertNotificationLanguageParams{UserID: user.ID, Language: &lang})
	}
	rows, err := app.queries.FindNotificationsForUser(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	unread, err := app.queries.CountUnreadNotifications(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	result := dtos.NotificationListDto{Items: []dtos.NotificationDto{}, Unread: unread}
	for _, n := range rows {
		result.Items = append(result.Items, dtos.NotificationDto{
			ID: n.ID, Type: n.Type, Title: n.Title, Body: n.Body, Link: n.Link, CreatedAt: n.CreatedAt, Read: n.ReadAt != nil,
		})
	}
	return c.JSON(http.StatusOK, result)
}

// browserLanguage returns "de" or "en" from an Accept-Language header, "" if neither.
func browserLanguage(header string) string {
	for _, part := range strings.Split(header, ",") {
		lang := strings.ToLower(strings.TrimSpace(strings.SplitN(part, ";", 2)[0]))
		if len(lang) >= 2 && (lang[:2] == "de" || lang[:2] == "en") {
			return lang[:2]
		}
	}
	return ""
}

func (app *application) markNotificationRead(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	if err := app.queries.MarkNotificationRead(c.Request().Context(), sqlc.MarkNotificationReadParams{ID: id, UserID: currentUser(c).ID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func (app *application) markAllNotificationsRead(c echo.Context) error {
	if err := app.queries.MarkAllNotificationsRead(c.Request().Context(), currentUser(c).ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// getNotificationSettings returns types, channels and the choices of the current user.
func (app *application) getNotificationSettings(c echo.Context) error {
	ctx := c.Request().Context()
	user := currentUser(c)
	server := app.notifyServer(ctx)
	channels, err := app.queries.FindNotificationChannelsForUser(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	prefs, err := app.queries.FindNotificationPreferences(ctx, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	result := dtos.NotificationSettingsDto{
		Types: reminderTypesFor(user), Kinds: []dtos.NotificationKindDto{}, Channels: []dtos.NotificationChannelDto{},
		Preferences: []dtos.NotificationPreferenceDto{}, DefaultNtfyServer: server.NtfyServer,
	}
	for _, kind := range notify.Kinds() {
		ch, _ := notify.Get(kind)
		result.Kinds = append(result.Kinds, dtos.NotificationKindDto{Kind: kind, Available: ch.Available(server)})
	}
	for _, ch := range channels {
		result.Channels = append(result.Channels, channelDto(ch))
	}
	for _, p := range prefs {
		result.Preferences = append(result.Preferences, dtos.NotificationPreferenceDto{Type: p.Type, Channel: p.Channel, Enabled: p.Enabled == 1})
	}
	return c.JSON(http.StatusOK, result)
}

func channelDto(ch sqlc.NotificationChannel) dtos.NotificationChannelDto {
	return dtos.NotificationChannelDto{ID: ch.ID, Kind: ch.Kind, Name: ch.Name, Config: json.RawMessage(ch.Config), Enabled: ch.Enabled == 1}
}

// validateChannel checks kind and configuration of a channel.
func (app *application) validateChannel(c echo.Context, kind string, config json.RawMessage) (json.RawMessage, error) {
	ch, err := notify.Get(kind)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	server := app.notifyServer(c.Request().Context())
	if !ch.Available(server) {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "channel "+kind+" is not set up by the admin")
	}
	normalized, err := ch.Validate(config, server)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return normalized, nil
}

func (app *application) createNotificationChannel(c echo.Context) error {
	var payload dtos.SaveNotificationChannelDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	config, err := app.validateChannel(c, payload.Kind, payload.Config)
	if err != nil {
		return err
	}
	ch, err := app.queries.InsertNotificationChannel(c.Request().Context(), sqlc.InsertNotificationChannelParams{
		UserID: currentUser(c).ID, Kind: payload.Kind, Name: strings.TrimSpace(payload.Name), Config: string(config), Enabled: boolToInt64(payload.Enabled),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, channelDto(ch))
}

func (app *application) ownChannel(c echo.Context) (sqlc.NotificationChannel, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return sqlc.NotificationChannel{}, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	ch, err := app.queries.FindNotificationChannel(c.Request().Context(), sqlc.FindNotificationChannelParams{ID: id, UserID: currentUser(c).ID})
	if err != nil {
		return sqlc.NotificationChannel{}, echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}
	return ch, nil
}

func (app *application) updateNotificationChannel(c echo.Context) error {
	ch, err := app.ownChannel(c)
	if err != nil {
		return err
	}
	var payload dtos.SaveNotificationChannelDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	config, err := app.validateChannel(c, ch.Kind, payload.Config)
	if err != nil {
		return err
	}
	if err := app.queries.UpdateNotificationChannel(c.Request().Context(), sqlc.UpdateNotificationChannelParams{
		Name: strings.TrimSpace(payload.Name), Config: string(config), Enabled: boolToInt64(payload.Enabled), ID: ch.ID, UserID: ch.UserID,
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	ch, _ = app.ownChannel(c)
	return c.JSON(http.StatusOK, channelDto(ch))
}

func (app *application) deleteNotificationChannel(c echo.Context) error {
	ch, err := app.ownChannel(c)
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	if err := app.queries.DeleteNotificationChannel(ctx, sqlc.DeleteNotificationChannelParams{ID: ch.ID, UserID: ch.UserID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	_ = app.queries.DeleteNotificationPreferencesForChannel(ctx, sqlc.DeleteNotificationPreferencesForChannelParams{
		UserID: ch.UserID, Channel: strconv.FormatInt(ch.ID, 10),
	})
	return c.NoContent(http.StatusOK)
}

// testNotificationChannel sends a test message, so the user sees right away whether it arrives.
func (app *application) testNotificationChannel(c echo.Context) error {
	ch, err := app.ownChannel(c)
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	t := app.texts(ctx, currentUser(c))
	server := app.notifyServer(ctx)
	msg := notify.Message{Type: "test", Title: t.f("testTitle"), Body: t.f("testBody"), Link: absoluteLink(server.PublicURL, "/settings/notifications")}
	if err := sendTo(ctx, ch, server, msg); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

func (app *application) saveNotificationPreference(c echo.Context) error {
	var payload dtos.NotificationPreferenceDto
	if err := BindAndValidate(c, &payload); err != nil {
		return err
	}
	user := currentUser(c)
	if !slices.Contains(reminderTypesFor(user), payload.Type) {
		return echo.NewHTTPError(http.StatusBadRequest, "unknown reminder type")
	}
	if payload.Channel != inAppChannel {
		if _, err := strconv.ParseInt(payload.Channel, 10, 64); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "unknown channel")
		}
	}
	if err := app.queries.UpsertNotificationPreference(c.Request().Context(), sqlc.UpsertNotificationPreferenceParams{
		UserID: user.ID, Type: payload.Type, Channel: payload.Channel, Enabled: boolToInt64(payload.Enabled),
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// --- admin: notification settings of the installation ---

func (app *application) getNotificationServer(c echo.Context) error {
	ctx := c.Request().Context()
	s := app.notifyServer(ctx)
	return c.JSON(http.StatusOK, dtos.NotificationServerDto{
		PublicURL: s.PublicURL, NtfyServer: s.NtfyServer, SMTPHost: s.SMTP.Host, SMTPPort: s.SMTP.Port,
		SMTPUsername: s.SMTP.Username, SMTPFrom: s.SMTP.From, SMTPSecurity: s.SMTP.Security, PasswordSet: s.SMTP.Password != "",
	})
}

func (app *application) saveNotificationServer(c echo.Context) error {
	var p dtos.SaveNotificationServerDto
	if err := BindAndValidate(c, &p); err != nil {
		return err
	}
	publicURL, err := normalizeURL(p.PublicURL)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	ntfyServer, err := normalizeURL(p.NtfyServer)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	ctx := c.Request().Context()
	values := map[string]string{
		settingPublicURL: strings.TrimRight(publicURL, "/"), settingNtfyServer: strings.TrimRight(ntfyServer, "/"),
		settingSMTPHost: strings.TrimSpace(p.SMTPHost), settingSMTPPort: strconv.Itoa(p.SMTPPort),
		settingSMTPUsername: strings.TrimSpace(p.SMTPUsername), settingSMTPFrom: strings.TrimSpace(p.SMTPFrom),
		settingSMTPSecurity: p.SMTPSecurity,
	}
	if p.SMTPPassword != "" || p.ClearPassword {
		values[settingSMTPPassword] = p.SMTPPassword
	}
	for key, value := range values {
		if err := app.saveSetting(ctx, key, value); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	}
	return app.getNotificationServer(c)
}

// testEmail sends a test email to the given address with the stored SMTP settings.
func (app *application) testEmail(c echo.Context) error {
	var p struct {
		To string `json:"to"`
	}
	if err := c.Bind(&p); err != nil || strings.TrimSpace(p.To) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "recipient missing")
	}
	ctx := c.Request().Context()
	t := app.texts(ctx, currentUser(c))
	if err := notify.SendMail(ctx, app.notifyServer(ctx).SMTP, strings.TrimSpace(p.To), t.f("testTitle"), t.f("testBody")); err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// checkReminders runs the reminder check now instead of waiting for the hourly run.
func (app *application) checkReminders(c echo.Context) error {
	n, err := app.generateReminders(c.Request().Context(), time.Now())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]int{"created": n})
}
