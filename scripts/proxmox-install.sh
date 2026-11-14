#!/usr/bin/env bash
set -euo pipefail

# Voltix Energy Dashboard - Proxmox / Debian / Ubuntu Installer
# Nutzung:
#   REPO_URL="https://github.com/DEIN_USER/DEIN_REPO.git" bash proxmox-install.sh

REPO_URL="${REPO_URL:-}"
INSTALL_DIR="${INSTALL_DIR:-/opt/voltix-dashboard}"
PORT="${PORT:-8080}"

if [[ -z "$REPO_URL" ]]; then
  echo "Fehler: Bitte REPO_URL angeben, z.B.:"
  echo '  REPO_URL="https://github.com/DEIN_USER/Energydashboard.git" bash proxmox-install.sh'
  exit 1
fi

echo "==> [1/4] Prüfe Abhängigkeiten (git, curl, docker)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installiere Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

echo "==> [2/4] Klone/Aktualisiere Repository nach ${INSTALL_DIR}..."
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "${INSTALL_DIR}" pull --ff-only
else
  git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

echo "==> [3/4] Konfiguriere Port ${PORT} und starte Container..."
cd "${INSTALL_DIR}"
sed -i "s/\"8080:3000\"/\"${PORT}:3000\"/" docker-compose.yml || true

GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo "")"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose build --build-arg GIT_COMMIT="${GIT_COMMIT}" --build-arg BUILD_DATE="${BUILD_DATE}"
docker compose up -d

echo "==> [4/4] Installiere Update-Befehl 'voltix-update'..."
chmod +x "${INSTALL_DIR}/scripts/update.sh"
ln -sf "${INSTALL_DIR}/scripts/update.sh" /usr/local/bin/voltix-update

IP_ADDR="$(hostname -I | awk '{print $1}')"
echo ""
echo "=========================================================="
echo " Voltix Energy Dashboard erfolgreich installiert!"
echo " Erreichbar unter: http://${IP_ADDR}:${PORT}"
echo " Update jederzeit via: voltix-update"
echo "=========================================================="
