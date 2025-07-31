package migrations

import "embed"

var (
	//go:embed sqlite/*.sql
	MigrationsCommon    embed.FS
	MigrationsCommonDir = "sqlite"
)
