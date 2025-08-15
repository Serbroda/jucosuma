SHELL := /bin/bash

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
.PHONY: build generate-go build-ui build-server clean test bump-major bump-minor bump-patch release release-major release-minor release-patch

build: clean generate-go build-ui build-server

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

REMOTE ?= origin

release-major: bump-major release
release-minor: bump-minor release
release-patch: bump-patch release

bump-major:
	@set -euo pipefail; \
	old="$$(tr -d '\r\n' < VERSION)"; \
	new="$$(./semver.sh bump major "$$old")"; \
	tmp="$$(mktemp)"; printf '%s\n' "$$new" > "$$tmp"; mv "$$tmp" VERSION; \
	( cd ./ui/v1 && npm version --no-git-tag-version "$$new" >/dev/null ); \
	echo "Bumped MAJOR: $$old → $$new"

bump-minor:
	@set -euo pipefail; \
	old="$$(tr -d '\r\n' < VERSION)"; \
	new="$$(./semver.sh bump minor "$$old")"; \
	tmp="$$(mktemp)"; printf '%s\n' "$$new" > "$$tmp"; mv "$$tmp" VERSION; \
	( cd ./ui/v1 && npm version --no-git-tag-version "$$new" >/dev/null ); \
	echo "Bumped MINOR: $$old → $$new"

bump-patch:
	@set -euo pipefail; \
	old="$$(tr -d '\r\n' < VERSION)"; \
	new="$$(./semver.sh bump patch "$$old")"; \
	tmp="$$(mktemp)"; printf '%s\n' "$$new" > "$$tmp"; mv "$$tmp" VERSION; \
	( cd ./ui/v1 && npm version --no-git-tag-version "$$new" >/dev/null ); \
	echo "Bumped PATCH: $$old → $$new"

release:
	@set -euo pipefail; \
	vers="$$(tr -d '\r\n' < VERSION)"; \
	git add VERSION 2>/dev/null || true; \
	git add ./ui/v1/package.json 2>/dev/null || true; \
	[[ -f ./ui/v1/package-lock.json ]] && git add ./ui/v1/package-lock.json || true; \
	if git diff --cached --quiet; then \
	  echo "No changes to commit for v$$vers (already up-to-date)"; \
	else \
	  git commit -m "chore(release): v$$vers"; \
	fi; \
	if git rev-parse -q --verify "refs/tags/v$$vers" >/dev/null; then \
	  echo "Tag v$$vers already exists. Skipping tag creation."; \
	else \
	  git tag -a "v$$vers" -m "v$$vers"; \
	fi; \
	git push $(REMOTE) HEAD; \
	git push $(REMOTE) "v$$vers"; \
	echo "Released v$$vers"