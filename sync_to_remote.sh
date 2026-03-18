#!/bin/bash
# Sync local files to remote Hetzner worker

REMOTE_IP="168.119.236.220"
REMOTE_DIR="/root/cross-script-alignment"

echo "🔄 Syncing files to $REMOTE_IP..."

rsync -avz \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '.DS_Store' \
  --exclude 'venv' \
  ./ root@$REMOTE_IP:$REMOTE_DIR/

echo "✅ Sync complete!"
