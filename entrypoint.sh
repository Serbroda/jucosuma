#!/bin/sh

exec /app/jucosuma \
  --addr "${ADDR}" \
  --db-path "${DB_PATH}" \
  --uploads-dir "${UPLOADS_DIR}" \
  "$@"
