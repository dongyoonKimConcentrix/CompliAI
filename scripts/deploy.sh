#!/usr/bin/env bash
# CompliAI Docker Compose 배포/업데이트
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "오류: .env 파일이 없습니다. cp .env.example .env 후 값을 채워주세요."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${NEXTAUTH_SECRET:-}" ] || [ "$NEXTAUTH_SECRET" = "your_nextauth_secret_here" ]; then
  echo "오류: NEXTAUTH_SECRET을 .env에 설정하세요."
  exit 1
fi

if [ -z "${NEXTAUTH_URL:-}" ] || [ "$NEXTAUTH_URL" = "http://localhost:3000" ]; then
  echo "경고: NEXTAUTH_URL이 로컬 주소입니다. 프로덕션에서는 http://공인IP 형태로 설정하세요."
fi

echo "==> Docker 이미지 빌드 및 컨테이너 시작"
docker compose pull --ignore-buildable 2>/dev/null || true
docker compose up -d --build

echo ""
echo "==> 컨테이너 상태"
docker compose ps

echo ""
echo "==> 헬스 체크 (최대 60초 대기)"
for i in $(seq 1 12); do
  if curl -fsS "http://127.0.0.1:80" >/dev/null 2>&1; then
    echo "Web OK — http://127.0.0.1 (또는 NEXTAUTH_URL)"
    break
  fi
  sleep 5
done

if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
  echo "API OK — http://127.0.0.1:8000/health"
else
  echo "API 헬스 체크 실패 — docker compose logs api 확인"
fi

echo ""
echo "배포 완료. Admin 지정:"
echo '  docker compose exec db psql -U myuser -d compliai_db -c "UPDATE \"User\" SET role = '\''ADMIN'\'' WHERE email = '\''your@email.com'\'';"'
