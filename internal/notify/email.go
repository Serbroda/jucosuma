package notify

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

// SMTPSettings of the installation (admin). Security is "starttls", "tls" or "none".
type SMTPSettings struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	Security string `json:"security"`
}

// Configured tells whether emails can be sent at all.
func (s SMTPSettings) Configured() bool {
	return s.Host != "" && s.Port > 0 && s.From != ""
}

// EmailConfig is a user's email channel.
type EmailConfig struct {
	Address string `json:"address"`
}

type emailChannel struct{}

func init() {
	Register(emailChannel{})
}

func (emailChannel) Kind() string { return "email" }

func (emailChannel) Available(server Server) bool { return server.SMTP.Configured() }

func (emailChannel) Validate(raw json.RawMessage, _ Server) (json.RawMessage, error) {
	var cfg EmailConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("invalid email settings: %w", err)
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(cfg.Address))
	if err != nil {
		return nil, fmt.Errorf("invalid email address")
	}
	cfg.Address = addr.Address
	return json.Marshal(cfg)
}

func (emailChannel) Send(ctx context.Context, raw json.RawMessage, server Server, msg Message) error {
	var cfg EmailConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	body := msg.Body
	if msg.Link != "" {
		body += "\n\n" + msg.Link
	}
	return SendMail(ctx, server.SMTP, cfg.Address, msg.Title, body)
}

// SendMail sends a plain text email with the SMTP settings.
func SendMail(ctx context.Context, s SMTPSettings, to, subject, body string) error {
	if !s.Configured() {
		return fmt.Errorf("SMTP is not configured")
	}
	from, err := mail.ParseAddress(s.From)
	if err != nil {
		return fmt.Errorf("invalid sender address: %w", err)
	}
	addr := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	dialer := &net.Dialer{Timeout: 15 * time.Second}

	var conn net.Conn
	if s.Security == "tls" {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: s.Host})
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	client, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer client.Close()

	if s.Security == "starttls" {
		if err := client.StartTLS(&tls.Config{ServerName: s.Host}); err != nil {
			return fmt.Errorf("starttls: %w", err)
		}
	}
	if s.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("authentication: %w", err)
		}
	}
	if err := client.Mail(from.Address); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	headers := []string{
		"From: " + from.String(),
		"To: " + to,
		"Subject: " + encodeHeader(subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
	}
	text := strings.ReplaceAll(body, "\n", "\r\n")
	if _, err := w.Write([]byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + text + "\r\n")); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

// encodeHeader encodes non-ASCII header values (RFC 2047).
func encodeHeader(s string) string {
	return mime.QEncoding.Encode("utf-8", s)
}
