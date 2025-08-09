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
		npm install && \
		npm run build

build-docker:
	@set -e; \
	major=$$(./semver.sh get major $(VERSION)); \
	minor=$$(./semver.sh get minor $(VERSION)); \
	echo "Building $(BINARY_NAME) docker image v$(VERSION) (major=$$major minor=$$minor)"; \
	docker build \
	  --build-arg VERSION=$(VERSION) \
	  -t $(BINARY_NAME):$$major \
	  -t $(BINARY_NAME):$$major.$$minor \
	  -t $(BINARY_NAME):$(VERSION) \
	  -t $(BINARY_NAME):latest \
	  .

build-podman:
	@set -e; \
	major=$$(./semver.sh get major $(VERSION)); \
	minor=$$(./semver.sh get minor $(VERSION)); \
	echo "Building $(BINARY_NAME) podman image v$(VERSION) (major=$$major minor=$$minor)"; \
	podman build \
	  --build-arg VERSION=$(VERSION) \
	  -t $(BINARY_NAME):$$major \
	  -t $(BINARY_NAME):$$major.$$minor \
	  -t $(BINARY_NAME):$(VERSION) \
	  -t $(BINARY_NAME):latest \
	  .

generate-go:
	@echo "==> Generating Go code..."
	go generate ./...
	@echo "==> Generation done."

test:
	@echo "==> Running tests..."
	go test ./... -v

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
clean:
	@echo "==> Cleaning up..."
	rm -rf ./bin/
	rm -rf ./ui/v1/node_modules/
	rm -rf ./ui/v1/dist/

bump-major:
	@set -e; \
	newVersion=$$(./semver.sh bump major $(VERSION)); \
	echo $$newVersion > VERSION; \
	cd ./ui/v1; \
	npm version --no-git-tag-version $$newVersion; \
	echo "Bumped version to $$newVersion"

bump-minor:
	@set -e; \
	newVersion=$$(./semver.sh bump minor $(VERSION)); \
	echo $$newVersion > VERSION; \
	cd ./ui/v1; \
	npm version --no-git-tag-version $$newVersion; \
	echo "Bumped version to $$newVersion"

bump-patch:
	@set -e; \
	newVersion=$$(./semver.sh bump patch $(VERSION)); \
	echo $$newVersion > VERSION; \
	cd ./ui/v1; \
	npm version --no-git-tag-version $$newVersion; \
	echo "Bumped version to $$newVersion"
