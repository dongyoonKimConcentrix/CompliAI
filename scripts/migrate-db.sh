#!/usr/bin/env bash
# DB 기동 → legacy 데이터 마이그레이션 → prisma db push
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

echo "==> DB 컨테이너 기동"
$COMPOSE up -d db

echo "==> Legacy 데이터 마이그레이션 (구 스키마 → displayId/targetUserId)"
$COMPOSE --profile migrate run --rm --entrypoint node migrate prisma/migrate-legacy.mjs

echo "==> Prisma 스키마 반영 (db push)"
$COMPOSE --profile migrate run --rm migrate
