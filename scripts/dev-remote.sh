#!/bin/bash
REMOTE_HOST="168.119.236.220"

echo "-------------------------------------------------------"
echo "🚀 Establishing SSH Tunnel & Starting Dev Servers"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "-------------------------------------------------------"

# Kill any existing local processes on ports 3000 and 8000 to avoid conflicts
for PORT in 3000 8000; do
    LOCAL_PID=$(lsof -ti:$PORT)
    if [ ! -z "$LOCAL_PID" ]; then
        echo "Stopping existing local process on port $PORT (PID: $LOCAL_PID)..."
        kill -9 $LOCAL_PID 2>/dev/null
    fi
done

# Start servers remotely and tunnel ports
# We start the backend in the background first, then run next dev in foreground
ssh -t -o StrictHostKeyChecking=no -L 3000:localhost:3000 -L 8000:localhost:8000 root@$REMOTE_HOST \
    "cd /root/cross-script-alignment/backend && (nohup ./venv/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /root/backend.log 2>&1 &) && cd /root/cross-script-alignment && npm run dev"
