package ui

import (
	"embed"
	"strings"

	"github.com/labstack/echo/v4"
)

var (
	//go:embed v1/dist
	FrontendDist embed.FS
	//go:embed v1/dist/index.html
	IndexHTML embed.FS
	DistPath  = "v1/dist"
)

var (
	distDirFS     = echo.MustSubFS(FrontendDist, DistPath)
	distIndexHtml = echo.MustSubFS(IndexHTML, DistPath)
)

func RegisterUi(e *echo.Echo) {
	e.Use(cacheHeaders)
	e.StaticFS("/", distDirFS)
	e.FileFS("/", "index.html", distIndexHtml)
}

// cacheHeaders makes the browser revalidate the frontend on every load so a new build is
// picked up immediately. Files under /assets/ carry a content hash in their name and may be
// cached forever; API and upload responses are left alone.
func cacheHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path
		switch {
		case strings.HasPrefix(path, "/api/"), strings.HasPrefix(path, "/uploads/"):
		case strings.HasPrefix(path, "/assets/"):
			c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		default:
			c.Response().Header().Set("Cache-Control", "no-cache")
		}
		return next(c)
	}
}
