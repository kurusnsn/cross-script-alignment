#!/bin/bash
# watch_and_sync.sh - Automated file synchronization with SSH Multiplexing

REMOTE_IP="168.119.236.220"
SOCK="/tmp/align_ssh_mux"

echo "🔌 Establishing persistent connection to $REMOTE_IP..."
# Start master connection in background
# -M: Master mode
# -S: Socket path
# -f: Fork to background
# -n: No stdin
# -N: No command (just forward/persist)
# -T: No pseudo-tty
ssh -M -S "$SOCK" -fnNT root@$REMOTE_IP

# Check if connection succeeded
if [ $? -ne 0 ]; then
    echo "❌ Failed to establish persistent SSH connection."
    exit 1
fi

echo "✅ Connected. Optimizing rsync to use persistent socket: $SOCK"

# Configure cleanup to close the master connection when script exits
trap "echo '🔌 Closing connection...'; ssh -S '$SOCK' -O exit root@$REMOTE_IP" EXIT

# Export RSYNC_RSH so 'rsync' in the sub-script uses our socket
export RSYNC_RSH="ssh -S $SOCK"

echo "👀 Watching for changes in $(pwd)..."
echo "Excluding: node_modules, .git, venv, .next, __pycache__"

# Initial sync
echo "🔄 Initial sync..."
./sync_to_remote.sh

# Watch loop
fswatch -o . -l 1 \
  -e "node_modules" \
  -e "\.git" \
  -e "venv" \
  -e "__pycache__" \
  -e "\.next" \
  -e "\.DS_Store" \
  | while read change; do
    echo "⚡ Change detected. Syncing..."
    ./sync_to_remote.sh
    echo "👀 Waiting for next change..."
done
