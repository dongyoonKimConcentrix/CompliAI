#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Applying Prisma schema..."
  node ./node_modules/prisma/build/index.js db push --skip-generate
fi

exec node server.js
