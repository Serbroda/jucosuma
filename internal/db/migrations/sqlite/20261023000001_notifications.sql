-- +goose Up
-- +goose StatementBegin
-- Reminders per user. The row is the in-app notification (bell) and at the same time guarantees
-- that a reminder (dedupe_key) is created and sent only once per user.
CREATE TABLE notifications
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       TEXT     NOT NULL,
    dedupe_key TEXT     NOT NULL,
    title      TEXT     NOT NULL,
    body       TEXT     NOT NULL DEFAULT '',
    link       TEXT,
    in_app     INTEGER  NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at    DATETIME,
    UNIQUE (user_id, dedupe_key)
);

-- External channels of a user (ntfy, email, …); kind-specific settings as JSON.
CREATE TABLE notification_channels
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT     NOT NULL,
    name       TEXT     NOT NULL DEFAULT '',
    config     TEXT     NOT NULL DEFAULT '{}',
    enabled    INTEGER  NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Which reminder type goes to which channel ('inapp' or a channel id). Missing rows mean enabled.
CREATE TABLE notification_preferences
(
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type    TEXT    NOT NULL,
    channel TEXT    NOT NULL,
    enabled INTEGER NOT NULL,
    PRIMARY KEY (user_id, type, channel)
);

-- Per-user data for notifications, e.g. the language of the browser for texts sent by the server.
CREATE TABLE notification_profiles
(
    user_id  INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    language TEXT
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE notification_profiles;
DROP TABLE notification_preferences;
DROP TABLE notification_channels;
DROP TABLE notifications;
-- +goose StatementEnd
