package utils

import "strings"

func TrimToEmpty(s *string) string {
	if s == nil {
		return ""
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return ""
	}
	return trimmed
}

func TrimToNil(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
