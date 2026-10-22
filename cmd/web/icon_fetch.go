package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	_ "golang.org/x/image/webp"
)

const (
	iconMaxBytes  = 5 << 20 // largest image that is downloaded
	iconMaxPixels = 4096    // longest side; protects against decompression bombs
)

// iconImageTypes are the image types accepted from a URL. SVG is left out: it is XML that can carry
// scripts and cannot be checked by decoding it.
var iconImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
}

type iconFromURLRequest struct {
	URL string `json:"url"`
}

type iconFromURLResponse struct {
	Icon string `json:"icon"` // data URL of the downloaded image
}

var errNotAnImage = errors.New("not an image")

// iconFromURL downloads an image for an icon. Only real images (checked by decoding them) are returned,
// as data URL, so the icon is stored like an uploaded one and does not depend on the other server.
func (app *application) iconFromURL(c echo.Context) error {
	var payload iconFromURLRequest
	if err := c.Bind(&payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}
	target, err := parseIconURL(payload.URL)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()
	data, err := downloadIcon(ctx, iconHTTPClient(), target)
	if err != nil {
		c.Logger().Warnf("icon from %s: %v", target.Host, err)
		if errors.Is(err, errNotAnImage) {
			return echo.NewHTTPError(http.StatusUnprocessableEntity, "the address does not point to an image")
		}
		return echo.NewHTTPError(http.StatusBadGateway, "the image could not be downloaded")
	}
	return c.JSON(http.StatusOK, iconFromURLResponse{Icon: data})
}

func parseIconURL(raw string) (*url.URL, error) {
	target, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" {
		return nil, errors.New("enter an address starting with http:// or https://")
	}
	if target.User != nil {
		return nil, errors.New("addresses with login data are not supported")
	}
	return target, nil
}

// iconHTTPClient refuses connections to the server itself and to link-local addresses (e.g. cloud
// metadata). Addresses in the home network stay allowed, e.g. a self-hosted Paperless.
func iconHTTPClient() *http.Client {
	dialer := &net.Dialer{
		Timeout: 10 * time.Second,
		Control: func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if ip == nil || !allowedIconIP(ip) {
				return fmt.Errorf("address %s is not allowed", host)
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 nil, // a proxy would bypass the address check
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("redirect to unsupported scheme")
			}
			return nil
		},
	}
}

func allowedIconIP(ip net.IP) bool {
	return !(ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() || ip.IsInterfaceLocalMulticast())
}

// downloadIcon fetches the URL and returns it as data URL if it really is an image of a supported type.
func downloadIcon(ctx context.Context, client *http.Client, target *url.URL) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "image/png,image/jpeg,image/gif,image/webp,image/*;q=0.8")
	req.Header.Set("User-Agent", "Jucosuma")
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status %d", res.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, iconMaxBytes+1))
	if err != nil {
		return "", err
	}
	if len(body) > iconMaxBytes {
		return "", fmt.Errorf("%w: larger than %d bytes", errNotAnImage, iconMaxBytes)
	}
	mime, err := checkIconImage(body)
	if err != nil {
		return "", err
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body), nil
}

// checkIconImage tells the image type by the content (not by the header of the other server) and decodes
// the image completely, so only real images pass.
func checkIconImage(data []byte) (string, error) {
	mime := http.DetectContentType(data)
	if !iconImageTypes[mime] {
		return "", fmt.Errorf("%w: content is %s", errNotAnImage, mime)
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("%w: %v", errNotAnImage, err)
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > iconMaxPixels || config.Height > iconMaxPixels {
		return "", fmt.Errorf("%w: size %dx%d", errNotAnImage, config.Width, config.Height)
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return "", fmt.Errorf("%w: %v", errNotAnImage, err)
	}
	return mime, nil
}
