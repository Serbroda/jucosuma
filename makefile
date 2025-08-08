SHELL := /bin/sh

# ------------------------------------------------------------
# Project informations
# ------------------------------------------------------------
BINARY_NAME := jucosuma
VERSION := $(shell cat VERSION)

# Paths
OUT_DIR := bin
WEB_MAIN_DIR := ./cmd/web

# ------------------------------------------------------------
# Default targets
# ------------------------------------------------------------
.PHONY: all build generate-go build-ui build-server clean test

all: clean generate-go build-ui build-server

build-server:
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

build-ui:
	cd ui/v1 && \
		npm i && \
		npm run build

build-docker: generate-go
	docker build \
	  --build-arg VERSION=$(cat VERSION) \
	  -t ${BINARY_NAME}:latest .

build-podman: generate-go
	podman build \
	  --build-arg VERSION=$(cat VERSION) \
	  -t ${BINARY_NAME}:latest .

generate-go:
	@echo "==> Generating Go code..."
	go generate ./...
	@echo "==> Generation done."

clean:
	@echo "==> Cleaning up..."
	rm -rf bin/
	rm -rf ui/v1/node_modules
	rm -rf ui/v1/dist

test:
	@echo "==> Running tests..."
	go test ./... -v
