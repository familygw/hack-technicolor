#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/technicolor-wifi-zone}"
SERVICE_NAME="${SERVICE_NAME:-technicolor-wifi-zone.service}"
SOURCE_DIR="${SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TARGET_DIR="${APP_ROOT}/daemon"
ENV_FILE="${TARGET_DIR}/technicolor-wifi-zone.env"
EXAMPLE_ENV_FILE="${TARGET_DIR}/technicolor-wifi-zone.env.example"

echo "Installing daemon from ${SOURCE_DIR} into ${TARGET_DIR}"

sudo mkdir -p "$TARGET_DIR"
sudo cp -R "$SOURCE_DIR"/. "$TARGET_DIR"/

cd "$TARGET_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  sudo cp "$EXAMPLE_ENV_FILE" "$ENV_FILE"
  echo "Created ${ENV_FILE} from example. Edit it first, then rerun this script."
  echo "Suggested command: sudo nano $ENV_FILE"
  exit 1
fi

if grep -q '^MODEM_PASSWORD=replace-me$' "$ENV_FILE"; then
  echo "${ENV_FILE} still contains replace-me. Edit it first, then rerun this script."
  echo "Suggested command: sudo nano $ENV_FILE"
  exit 1
fi

echo "Installing runtime dependencies"
npm ci --omit=dev

echo "Installing systemd unit"
sudo cp "$TARGET_DIR/technicolor-wifi-zone.service" "/etc/systemd/system/${SERVICE_NAME}"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "Service status"
sudo systemctl status "$SERVICE_NAME" --no-pager --lines=20

echo
echo "Recent logs"
sudo journalctl -u "$SERVICE_NAME" --no-pager -n 30