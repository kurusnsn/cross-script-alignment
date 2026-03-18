#!/bin/bash
REMOTE_HOST="168.119.236.220"
REMOTE_USER="root"
REMOTE_DIR="/root/cross-script-alignment/"
LOCAL_DIR="./"

# SSH Multiplexing setup
CONTROL_PATH="/tmp/ssh-mux-%r@%h:%p"

# Function to start the persistent master connection
start_master() {
    echo "Establishing persistent SSH connection..."
    ssh -o ControlMaster=auto -o ControlPath="$CONTROL_PATH" -o ControlPersist=10m -o StrictHostKeyChecking=no -f -N "$REMOTE_USER@$REMOTE_HOST"
}

# Function to run rsync via the multiplexed connection
run_sync() {
    rsync -avz -e "ssh -o ControlPath=$CONTROL_PATH" --exclude 'node_modules' --exclude '.next' --exclude 'backend/venv' --exclude '.git' "$LOCAL_DIR" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR"
}

# Ensure we are in the root of the project
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the project root."
    exit 1
fi

# Cleanup old socket
rm -f "$CONTROL_PATH"

start_master
echo "Running initial sync..."
run_sync

# Watch for changes if fswatch is available
if command -v fswatch >/dev/null 2>&1; then
    echo "fswatch detected with Multiplexing. Watching for changes..."
    # Debounce: wait for events to settle for 1 second
    fswatch -o "$LOCAL_DIR" -e "node_modules" -e ".next" -e ".git" | while read f; do
        # Simple sleep-based debounce
        sleep 1
        run_sync
        echo "Synced at $(date +%H:%M:%S)"
    done
else
    echo "fswatch not found. Install it for better performance."
    while true; do
        run_sync
        sleep 5
    done
fi
