#!/usr/bin/env bash
# Installs or updates the digest on an Ubuntu/Debian instance. Safe to re-run.
# Usage, from a copy of this project on the instance: sudo bash deploy/setup.sh
set -euo pipefail

APP_DIR=/opt/startup-news-sender
SERVICE_USER=startupnews
SERVICE_HOME=/var/lib/startupnews
MIN_NODE_MAJOR=20
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi
if ! command -v apt-get >/dev/null; then
  echo "This script supports Ubuntu/Debian only." >&2
  exit 1
fi

# The Agent SDK's suggested starting point is 1 GiB per agent, so smaller
# instances get swap to absorb the peak.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if (( mem_kb < 1000000 )) && [[ -z "$(swapon --show)" ]]; then
  echo "Adding a 2 GB swap file"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

node_major=0
if command -v node >/dev/null; then
  node_major=$(node -p 'process.versions.node.split(".")[0]')
fi
if (( node_major < MIN_NODE_MAJOR )); then
  echo "Installing Node.js LTS"
  apt-get update
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

apt-get install -y rsync

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$SERVICE_HOME" --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "Installing to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude .env --exclude state --exclude work --exclude out \
  "$SOURCE_DIR/" "$APP_DIR/"

cd "$APP_DIR"
# Optional dependencies must stay: they carry the SDK's bundled binary.
npm ci
npm run build
npm prune --omit=dev

mkdir -p state work
chown -R "$SERVICE_USER:$SERVICE_USER" state work

# systemd reads this file as root, so the service user never needs access to it.
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
chown root:root .env
chmod 600 .env

install -m 644 deploy/startup-news.service deploy/startup-news.timer /etc/systemd/system/
systemctl daemon-reload

if grep -qE '^(ANTHROPIC_API_KEY|RESEND_API_KEY|EMAIL_TO)=$' .env; then
  echo
  echo "Almost done. Fill in the settings, then enable the timer:"
  echo "  sudo nano $APP_DIR/.env"
  echo "  sudo systemctl enable --now startup-news.timer"
else
  systemctl enable --now startup-news.timer
  systemctl list-timers startup-news.timer --no-pager
fi
