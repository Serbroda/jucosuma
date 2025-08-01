SHELL := /bin/bash

# ------------------------------------------------------------
# Project informations
# ------------------------------------------------------------
BINARY_NAME := contracts
VERSION := $(shell cat VERSION)

# Paths
OUT_DIR := bin
WEB_MAIN_DIR := ./cmd/web

# ------------------------------------------------------------
# Default targets
# ------------------------------------------------------------
.PHONY: all build generate-go clean test

all: clean generate-go build-web

build-web:
	@echo "==> Building web Go binaries for platforms..."
	$(call build_bin,${WEB_MAIN_DIR},${BINARY_NAME},darwin,amd64,macos-amd64)
	$(call build_bin,${WEB_MAIN_DIR},${BINARY_NAME},darwin,arm64,macos-arm64)
	$(call build_bin,${WEB_MAIN_DIR},${BINARY_NAME},linux,amd64,linux-amd64)
	$(call build_bin,${WEB_MAIN_DIR},${BINARY_NAME},windows,amd64,windows-amd64.exe)
	@echo "==> Build complete!"

define build_bin
	@echo "==> Building Go binary for $(3)/$(4)..."
	GOOS=$(3) GOARCH=$(4) CGO_ENABLED=0 \
		go build -ldflags "-X main.Version=$(VERSION)" -o ${OUT_DIR}/$(2)-v${VERSION}-$(5) $(1)
endef

build-css:
	cd ui && \
		npm ini -y && \
		npm i tailwindcss @tailwindcss/cli && \
		npx @tailwindcss/cli -i ./input.css -o ./static/css/output.css --minify
	rm -rf ui/node_modules
	rm -f ui/package.json
	rm -f ui/package-lock.json

build-css-watch:
	cd ui && \
		npm ini -y && \
		npm i tailwindcss @tailwindcss/cli && \
		npx @tailwindcss/cli -i ./input.css -o ./static/css/output.css --watch

generate-go:
	@echo "==> Generating Go code..."
	go generate ./...
	@echo "==> Generation done."

clean:
	@echo "==> Cleaning up..."
	rm -rf bin/

test:
	@echo "==> Running tests..."
	go test ./... -v
