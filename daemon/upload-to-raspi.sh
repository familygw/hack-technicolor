#!/usr/bin/env bash

set -euo pipefail

SSH_TARGET="${SSH_TARGET:-pi3admin@pi3server.local}"
REMOTE_DIR="${REMOTE_DIR:-~/technicolor-wifi-zone-deploy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Uploading daemon directory to ${SSH_TARGET}:${REMOTE_DIR}"
scp -r "$SCRIPT_DIR" "$SSH_TARGET:$REMOTE_DIR"
echo "Upload complete. Connect to the Raspberry Pi and run install-on-raspi.sh from the uploaded daemon directory."