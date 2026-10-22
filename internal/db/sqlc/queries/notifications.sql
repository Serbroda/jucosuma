-- name: InsertNotification :one
INSERT OR IGNORE INTO notifications (user_id, type, dedupe_key, title, body, link, in_app)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING id;

-- name: FindNotificationsForUser :many
SELECT * FROM notifications
WHERE user_id = ? AND in_app = 1
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- name: CountUnreadNotifications :one
SELECT count(*) FROM notifications WHERE user_id = ? AND in_app = 1 AND read_at IS NULL;

-- name: MarkNotificationRead :exec
UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL;

-- name: DeleteOldNotifications :exec
DELETE FROM notifications WHERE created_at < ?;

-- name: FindNotificationChannelsForUser :many
SELECT * FROM notification_channels WHERE user_id = ? ORDER BY id;

-- name: FindNotificationChannel :one
SELECT * FROM notification_channels WHERE id = ? AND user_id = ?;

-- name: InsertNotificationChannel :one
INSERT INTO notification_channels (user_id, kind, name, config, enabled) VALUES (?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateNotificationChannel :exec
UPDATE notification_channels SET name = ?, config = ?, enabled = ? WHERE id = ? AND user_id = ?;

-- name: DeleteNotificationChannel :exec
DELETE FROM notification_channels WHERE id = ? AND user_id = ?;

-- name: FindNotificationPreferences :many
SELECT * FROM notification_preferences WHERE user_id = ?;

-- name: UpsertNotificationPreference :exec
INSERT INTO notification_preferences (user_id, type, channel, enabled) VALUES (?, ?, ?, ?)
ON CONFLICT (user_id, type, channel) DO UPDATE SET enabled = excluded.enabled;

-- name: DeleteNotificationPreferencesForChannel :exec
DELETE FROM notification_preferences WHERE user_id = ? AND channel = ?;

-- name: FindNotificationProfile :one
SELECT * FROM notification_profiles WHERE user_id = ?;

-- name: UpsertNotificationLanguage :exec
INSERT INTO notification_profiles (user_id, language) VALUES (?, ?)
ON CONFLICT (user_id) DO UPDATE SET language = excluded.language;
