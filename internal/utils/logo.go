package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// AppResult enthält die wichtigsten Felder aus dem iTunes API-Ergebnis
type AppResult struct {
	TrackName     string `json:"trackName"`
	ArtistName    string `json:"artistName"`
	ArtworkUrl100 string `json:"artworkUrl100"`
	ArtworkUrl512 string `json:"artworkUrl512"`
}

// iTunesResponse spiegelt die JSON-Antwort der API wider
type iTunesResponse struct {
	ResultCount int         `json:"resultCount"`
	Results     []AppResult `json:"results"`
}

func SearchAppLogos(term string) ([]AppResult, error) {
	query := url.Values{}
	query.Set("term", term)
	query.Set("entity", "software")
	query.Set("limit", "20")
	query.Set("country", "DE")

	apiUrl := fmt.Sprintf("https://itunes.apple.com/search?%s", query.Encode())
	resp, err := http.Get(apiUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result iTunesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Results, nil
}
