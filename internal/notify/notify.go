// Package notify delivers reminders to external channels (ntfy, email, …). Every channel kind
// implements Channel and registers itself; the in-app bell is not a channel here but the
// notification row itself.
package notify

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
)

// Message is what a channel sends. Link is an absolute URL into the app, or empty.
type Message struct {
	Type  string
	Title string
	Body  string
	Link  string
}

// Server holds the settings of the installation that channels may need (maintained by admins).
type Server struct {
	PublicURL  string
	NtfyServer string
	SMTP       SMTPSettings
}

// Channel is one kind of external channel. Config is the per-user configuration as JSON.
type Channel interface {
	Kind() string
	// Validate checks and normalizes a user's configuration before it is stored.
	Validate(config json.RawMessage, server Server) (json.RawMessage, error)
	// Available tells whether the channel can be used with the server settings (e.g. SMTP set up).
	Available(server Server) bool
	Send(ctx context.Context, config json.RawMessage, server Server, msg Message) error
}

var channels = map[string]Channel{}

// Register makes a channel kind available. Called from init functions of the channel files.
func Register(c Channel) {
	channels[c.Kind()] = c
}

// Get returns the channel of a kind.
func Get(kind string) (Channel, error) {
	c, ok := channels[kind]
	if !ok {
		return nil, fmt.Errorf("unknown channel kind %q", kind)
	}
	return c, nil
}

// Kinds lists the registered channel kinds, sorted.
func Kinds() []string {
	kinds := make([]string, 0, len(channels))
	for k := range channels {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	return kinds
}
