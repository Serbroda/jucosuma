package main

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/Serbroda/contracts/cmd/web/dtos"
	sqlc "github.com/Serbroda/contracts/internal/db/sqlc/gen"
)

// normalizeURL accepts only http(s) links, so a stored link can never run script code
// (javascript:, data: …) when clicked. Without a scheme, https:// is assumed
// ("www.example.com"). An empty value stays empty.
func normalizeURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if !strings.Contains(raw, "://") && !strings.Contains(raw, ":") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", fmt.Errorf("invalid link %q: only http and https addresses are allowed", raw)
	}
	return u.String(), nil
}

// normalizeOptionalURL normalizes an optional link; empty values become nil.
func normalizeOptionalURL(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	normalized, err := normalizeURL(*raw)
	if err != nil || normalized == "" {
		return nil, err
	}
	return &normalized, nil
}

// replaceContractLinks stores the given links of an entry in their order. Links without
// address are skipped; links without title use the host name.
func replaceContractLinks(ctx context.Context, q *sqlc.Queries, contractID int64, links []dtos.ContractLinkDto) error {
	if err := q.DeleteContractLinksByContractId(ctx, contractID); err != nil {
		return err
	}
	for i, l := range links {
		link, err := normalizeURL(l.URL)
		if err != nil {
			return err
		}
		if link == "" {
			continue
		}
		title := strings.TrimSpace(l.Title)
		if title == "" {
			if u, err := url.Parse(link); err == nil {
				title = u.Host
			}
		}
		if err := q.InsertContractLink(ctx, sqlc.InsertContractLinkParams{
			ContractID: contractID, Title: title, Url: link, SortOrder: int64(i),
		}); err != nil {
			return err
		}
	}
	return nil
}
