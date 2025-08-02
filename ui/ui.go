package ui

import (
	"embed"
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
	e.StaticFS("/", distDirFS)
	e.FileFS("/", "index.html", distIndexHtml)
}
