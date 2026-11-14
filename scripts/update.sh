#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/voltix-dashboard}"

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  echo "Fehler: ${INSTALL_DIR} ist kein Git-Repository."
  exit 1
fi

echo "==> Hole neueste Änderungen von GitHub..."
cd "${INSTALL_DIR}"
LOCAL_REV="$(git rev-parse HEAD)"
git fetch origin
REMOTE_REV="$(git rev-parse @{u})"

if [[ "${LOCAL_REV}" == "${REMOTE_REV}" ]]; then
  echo "==> Bereits auf dem neuesten Stand (${LOCAL_REV:0:7})."
  exit 0
fi

echo "==> Update gefunden (${LOCAL_REV:0:7} -> ${REMOTE_REV:0:7}). Aktualisiere..."
git pull --ff-only

GIT_COMMIT="$(git rev-parse HEAD)"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

docker compose build --build-arg GIT_COMMIT="${GIT_COMMIT}" --build-arg BUILD_DATE="${BUILD_DATE}"
docker compose up -d --remove-orphans
docker image prune -f

echo "==> Update abgeschlossen! Aktiv ist jetzt Commit ${GIT_COMMIT:0:7}."
