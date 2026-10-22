package notify

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNtfyValidateAndSend(t *testing.T) {
	ch, err := Get("ntfy")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ch.Validate(json.RawMessage(`{"topic":"bad topic!"}`), Server{}); err == nil {
		t.Error("invalid topic accepted")
	}
	if _, err := ch.Validate(json.RawMessage(`{"topic":"ok","server":"javascript:alert(1)"}`), Server{}); err == nil {
		t.Error("non-http server accepted")
	}

	var got *http.Request
	var body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		b, _ := io.ReadAll(r.Body)
		body = string(b)
	}))
	defer srv.Close()

	cfg, err := ch.Validate(json.RawMessage(`{"topic":" haushalt ","token":"tk"}`), Server{})
	if err != nil {
		t.Fatal(err)
	}
	msg := Message{Title: "Kündigungsfrist: Handy", Body: "Kündbar bis 15.11.", Link: "https://app/#/contracts/1"}
	if err := ch.Send(context.Background(), cfg, Server{NtfyServer: srv.URL}, msg); err != nil {
		t.Fatal(err)
	}
	if got.URL.Path != "/haushalt" || body != msg.Body || got.Header.Get("Click") != msg.Link ||
		got.Header.Get("Authorization") != "Bearer tk" || !strings.Contains(got.Header.Get("Title"), "=?utf-8?") {
		t.Errorf("unexpected request: path %s body %q headers %v", got.URL.Path, body, got.Header)
	}
}

func TestEmailValidate(t *testing.T) {
	ch, _ := Get("email")
	if _, err := ch.Validate(json.RawMessage(`{"address":"nope"}`), Server{}); err == nil {
		t.Error("invalid address accepted")
	}
	cfg, err := ch.Validate(json.RawMessage(`{"address":" Danny <danny@example.com> "}`), Server{})
	if err != nil || !strings.Contains(string(cfg), `"danny@example.com"`) {
		t.Errorf("address not normalized: %s, %v", cfg, err)
	}
	if ch.Available(Server{}) {
		t.Error("email available without SMTP")
	}
}
