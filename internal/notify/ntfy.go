package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// NtfyConfig is a user's ntfy subscription. Server is optional (default: the admin's ntfy server).
type NtfyConfig struct {
	Server string `json:"server,omitempty"`
	Topic  string `json:"topic"`
	Token  string `json:"token,omitempty"`
}

var ntfyTopic = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

type ntfyChannel struct{ client *http.Client }

func init() {
	Register(ntfyChannel{client: &http.Client{Timeout: 15 * time.Second}})
}

func (ntfyChannel) Kind() string { return "ntfy" }

func (ntfyChannel) Available(Server) bool { return true }

func (ntfyChannel) Validate(raw json.RawMessage, _ Server) (json.RawMessage, error) {
	var cfg NtfyConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("invalid ntfy settings: %w", err)
	}
	cfg.Topic = strings.TrimSpace(cfg.Topic)
	if !ntfyTopic.MatchString(cfg.Topic) {
		return nil, fmt.Errorf("invalid ntfy topic: letters, digits, - and _ only")
	}
	if cfg.Server = strings.TrimRight(strings.TrimSpace(cfg.Server), "/"); cfg.Server != "" {
		if err := checkHTTPURL(cfg.Server); err != nil {
			return nil, err
		}
	}
	cfg.Token = strings.TrimSpace(cfg.Token)
	return json.Marshal(cfg)
}

func (c ntfyChannel) Send(ctx context.Context, raw json.RawMessage, server Server, msg Message) error {
	var cfg NtfyConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	base := cfg.Server
	if base == "" {
		base = server.NtfyServer
	}
	if base == "" {
		base = "https://ntfy.sh"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(base, "/")+"/"+cfg.Topic, bytes.NewBufferString(msg.Body))
	if err != nil {
		return err
	}
	// ntfy reads non-ASCII header values as RFC 2047 encoded words
	req.Header.Set("Title", encodeHeader(msg.Title))
	req.Header.Set("Tags", "bell")
	if msg.Link != "" {
		req.Header.Set("Click", msg.Link)
	}
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("ntfy answered %s", res.Status)
	}
	return nil
}

// checkHTTPURL accepts only http(s) URLs with a host.
func checkHTTPURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Errorf("invalid address %q: http or https expected", raw)
	}
	return nil
}
