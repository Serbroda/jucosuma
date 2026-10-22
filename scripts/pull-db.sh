#!/usr/bin/env bash
# Replaces the local database with a copy of the production database.
#
# Usage:  scripts/pull-db.sh
# Config (environment variables, defaults in brackets):
#   REMOTE       ssh target          [root@192.168.2.41]
#   REMOTE_DB    database on server  [/opt/stacks/jucosuma/data/jucosuma.db]
#   LOCAL_DB     local database      [<repo>/jucosuma.db]
#
# The previous local database is kept as jucosuma.backup-<timestamp>.db next to it.
set -euo pipefail

REMOTE="${REMOTE:-root@192.168.2.41}"
REMOTE_DB="${REMOTE_DB:-/opt/stacks/jucosuma/data/jucosuma.db}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DB="${LOCAL_DB:-$REPO_DIR/jucosuma.db}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
remote_tmp="/tmp/jucosuma-pull-$$.db"

echo "==> Copying $REMOTE:$REMOTE_DB"
# A consistent snapshot via the SQLite backup API if sqlite3 exists on the server,
# otherwise a plain file copy.
if ssh "$REMOTE" "command -v sqlite3 >/dev/null && sqlite3 '$REMOTE_DB' \".backup '$remote_tmp'\""; then
    scp -q "$REMOTE:$remote_tmp" "$tmp/jucosuma.db"
    ssh "$REMOTE" "rm -f '$remote_tmp'"
else
    echo "    sqlite3 not available on server, copying the file directly"
    scp -q "$REMOTE:$REMOTE_DB" "$tmp/jucosuma.db"
fi

if command -v sqlite3 >/dev/null; then
    result="$(sqlite3 "$tmp/jucosuma.db" 'PRAGMA integrity_check;')"
    if [[ "$result" != "ok" ]]; then
        echo "!! Integrity check failed, local database left unchanged: $result" >&2
        exit 1
    fi
fi

if [[ -f "$LOCAL_DB" ]]; then
    backup="${LOCAL_DB%.db}.backup-$(date +%Y%m%d-%H%M%S).db"
    mv "$LOCAL_DB" "$backup"
    echo "==> Previous local database saved as $(basename "$backup")"
fi
mv "$tmp/jucosuma.db" "$LOCAL_DB"
echo "==> Replaced $LOCAL_DB"
