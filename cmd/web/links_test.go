package main

import "testing"

func TestNormalizeURL(t *testing.T) {
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"", "", false},
		{"  ", "", false},
		{"https://www.allianz.de", "https://www.allianz.de", false},
		{"http://paperless.local:8000/documents/42/", "http://paperless.local:8000/documents/42/", false},
		{"www.allianz.de/login", "https://www.allianz.de/login", false},
		{"javascript:alert(1)", "", true},
		{"JavaScript:alert(1)", "", true},
		{"data:text/html,<script>alert(1)</script>", "", true},
		{"ftp://example.com", "", true},
		{"https://", "", true},
	}
	for _, tt := range tests {
		got, err := normalizeURL(tt.in)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("normalizeURL(%q) = %q, %v; want %q, error %v", tt.in, got, err, tt.want, tt.wantErr)
		}
	}
}
