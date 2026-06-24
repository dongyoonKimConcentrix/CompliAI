#!/usr/bin/env bash
# 로컬(Mac)에서 Docker 이미지 빌드 후 Docker Hub push
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REGISTRY="${DOCKER_REGISTRY:-dongyoonkimconcentrix}"
TAG="${DOCKER_TAG:-latest}"

if [ -z "${DOCKERHUB_USERNAME:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
  echo "DOCKERHUB_USERNAME, DOCKERHUB_TOKEN 환경 변수를 설정하거나 docker login 하세요."
  docker info >/dev/null 2>&1 || { echo "Docker가 실행 중인지 확인하세요."; exit 1; }
fi

if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
fi

echo "==> Web 이미지 빌드"
docker build -t "${REGISTRY}/compliai-web:${TAG}" ./web

echo "==> API 이미지 빌드"
docker build -t "${REGISTRY}/compliai-api:${TAG}" ./api

echo "==> Migrate 이미지 빌드 (Prisma db push)"
docker build --target builder -t "${REGISTRY}/compliai-migrate:${TAG}" ./web

echo "==> Docker Hub push"
docker push "${REGISTRY}/compliai-web:${TAG}"
docker push "${REGISTRY}/compliai-api:${TAG}"
docker push "${REGISTRY}/compliai-migrate:${TAG}"

echo "완료: ${REGISTRY}/compliai-{web,api,migrate}:${TAG}"
