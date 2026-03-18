#!/bin/bash
# Deployment script for alignment-service on Hetzner worker

set -e

# Configuration
WORKER_IP="${1:-}"
REGISTRY="${2:-ghcr.io/yourusername}"
IMAGE_NAME="alignment-service"
IMAGE_TAG="latest"
CONTAINER_NAME="align-worker"

if [ -z "$WORKER_IP" ]; then
    echo "Usage: ./deploy.sh <worker-ip> [registry]"
    echo "Example: ./deploy.sh 1.2.3.4 ghcr.io/myuser"
    exit 1
fi

echo "🚀 Deploying alignment-service to $WORKER_IP"
echo "Registry: $REGISTRY"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# Build Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME:$IMAGE_TAG .

# Tag for registry
echo "🏷️  Tagging image..."
docker tag $IMAGE_NAME:$IMAGE_TAG $REGISTRY/$IMAGE_NAME:$IMAGE_TAG

# Push to registry
echo "⬆️  Pushing to registry..."
docker push $REGISTRY/$IMAGE_NAME:$IMAGE_TAG

# Deploy to worker
echo "🌐 Deploying to worker..."
ssh root@$WORKER_IP << EOF
    echo "Pulling latest image..."
    docker pull $REGISTRY/$IMAGE_NAME:$IMAGE_TAG
    
    echo "Stopping old container (if exists)..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    echo "Starting new container..."
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p 8000:8000 \
        $REGISTRY/$IMAGE_NAME:$IMAGE_TAG
    
    echo "Waiting for service to start..."
    sleep 5
    
    echo "Checking health..."
    curl -f http://localhost:8000/health || echo "Health check failed!"
    
    echo "Service deployed successfully!"
    docker ps | grep $CONTAINER_NAME
EOF

echo ""
echo "✅ Deployment complete!"
echo "Service URL: http://$WORKER_IP:8000"
echo ""
echo "Test with:"
echo "curl http://$WORKER_IP:8000/health"
