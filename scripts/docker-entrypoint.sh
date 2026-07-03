#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "[entrypoint] DATABASE_URL not set, skipping migrations."
fi

mkdir -p "${UPLOAD_DIR:-./public/uploads}"

echo "[entrypoint] Starting Next.js server..."
exec node server.js