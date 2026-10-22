package main

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestCheckIconImage(t *testing.T) {
	if mime, err := checkIconImage(pngBytes(t, 16, 16)); err != nil || mime != "image/png" {
		t.Fatalf("png: %q %v", mime, err)
	}
	cases := map[string][]byte{
		"html":      []byte("<!doctype html><html><body>not an image</body></html>"),
		"svg":       []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"truncated": pngBytes(t, 16, 16)[:40],
		"too large": pngBytes(t, iconMaxPixels+1, 1),
	}
	for name, data := range cases {
		if _, err := checkIconImage(data); !errors.Is(err, errNotAnImage) {
			t.Errorf("%s: expected errNotAnImage, got %v", name, err)
		}
	}
}

func TestDownloadIconChecksContentNotHeader(t *testing.T) {
	image := pngBytes(t, 8, 8)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/logo.png":
			w.Header().Set("Content-Type", "application/octet-stream")
			_, _ = w.Write(image)
		case "/fake.png":
			// claims to be an image but is a web page
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte("<html>login</html>"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	at := func(path string) *url.URL { u, _ := url.Parse(srv.URL + path); return u }
	data, err := downloadIcon(context.Background(), srv.Client(), at("/logo.png"))
	if err != nil || !strings.HasPrefix(data, "data:image/png;base64,") {
		t.Fatalf("logo: %v %.40s", err, data)
	}
	if _, err := downloadIcon(context.Background(), srv.Client(), at("/fake.png")); !errors.Is(err, errNotAnImage) {
		t.Errorf("fake: expected errNotAnImage, got %v", err)
	}
	if _, err := downloadIcon(context.Background(), srv.Client(), at("/missing.png")); err == nil || errors.Is(err, errNotAnImage) {
		t.Errorf("missing: expected download error, got %v", err)
	}
	// the real client refuses the server itself
	if _, err := downloadIcon(context.Background(), iconHTTPClient(), at("/logo.png")); err == nil {
		t.Error("loopback must be refused")
	}
}

func TestParseIconURLAndAddresses(t *testing.T) {
	for _, raw := range []string{"https://example.com/a.png", " http://192.168.2.41/logo.png "} {
		if _, err := parseIconURL(raw); err != nil {
			t.Errorf("%s: %v", raw, err)
		}
	}
	for _, raw := range []string{"", "ftp://example.com/a.png", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@example.com/a.png", "example.com/a.png"} {
		if _, err := parseIconURL(raw); err == nil {
			t.Errorf("%q should be refused", raw)
		}
	}
	for ip, allowed := range map[string]bool{"127.0.0.1": false, "::1": false, "169.254.169.254": false, "0.0.0.0": false, "192.168.2.41": true, "93.184.216.34": true} {
		if got := allowedIconIP(net.ParseIP(ip)); got != allowed {
			t.Errorf("%s: allowed=%v, want %v", ip, got, allowed)
		}
	}
}
