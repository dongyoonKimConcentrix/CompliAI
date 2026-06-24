#!/usr/bin/env bash
# Oracle Cloud VM (Ubuntu) 초기 설정 — 최초 1회 실행
set -euo pipefail

echo "==> CompliAI Oracle Cloud 초기 설정"

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo로 실행하세요: sudo bash scripts/oracle-setup.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git ufw

# Docker Engine
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Swap 3GB (1GB RAM VM OOM 방지)
if [ ! -f /swapfile ]; then
  fallocate -l 3G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=3072
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap 3GB 활성화 완료"
fi

# 방화벽 (SSH + HTTP + API 선택)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 8000/tcp
ufw --force enable

# 배포용 사용자 docker 그룹 (opc/ubuntu)
DEPLOY_USER="${SUDO_USER:-opc}"
if id "$DEPLOY_USER" &>/dev/null; then
  usermod -aG docker "$DEPLOY_USER"
fi

mkdir -p /opt/compliai
chown -R "$DEPLOY_USER:$DEPLOY_USER" /opt/compliai

echo ""
echo "초기 설정 완료. 배포 사용자($DEPLOY_USER)로 재로그인 후:"
echo "  cd /opt/compliai"
echo "  git clone https://github.com/dongyoonKimConcentrix/CompliAI.git ."
echo "  cp .env.example .env   # 값 수정 (NEXTAUTH_URL=http://공인IP)"
echo "  bash scripts/deploy.sh"
