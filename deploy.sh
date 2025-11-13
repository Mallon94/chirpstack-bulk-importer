#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/Mallon94/chirpstack-bulk-importer.git"
APP_NAME="chirpstack-bulk-importer"
CONTAINER_NAME="chirpstack-bulk-importer"
PORT="80"

echo "========================================"
echo "ChirpStack Bulk Importer Deployment"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker..."
    
    # Update system
    sudo yum update -y || sudo apt-get update -y
    
    # Install Docker
    if command -v yum &> /dev/null; then
        # Amazon Linux / RHEL
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    else
        # Ubuntu / Debian
        sudo apt-get install -y docker.io docker-compose
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    fi
    
    echo "Docker installed successfully!"
    echo "Please log out and log back in for group changes to take effect."
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed successfully!"
fi

# Stop and remove existing container
echo "Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Remove old images
echo "Cleaning up old images..."
docker image prune -f

# Clone or update repository
if [ -d "$APP_NAME" ]; then
    echo "Updating existing repository..."
    cd $APP_NAME
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL
    cd $APP_NAME
fi

# Prompt for environment variables if not set
if [ -z "$VITE_CHIRPSTACK_URL" ]; then
    echo ""
    echo "Please provide ChirpStack configuration:"
    read -p "ChirpStack URL (e.g., http://your-server-ip): " VITE_CHIRPSTACK_URL
    read -p "API Token: " VITE_CHIRPSTACK_API_TOKEN
    read -p "Application ID: " VITE_CHIRPSTACK_APPLICATION_ID
    read -p "Device Profile ID: " VITE_CHIRPSTACK_DEVICE_PROFILE_ID
    echo ""
fi

# Build Docker image with environment variables
echo "Building Docker image..."
docker build -t $APP_NAME:latest \
    --build-arg VITE_CHIRPSTACK_URL="$VITE_CHIRPSTACK_URL" \
    --build-arg VITE_CHIRPSTACK_API_TOKEN="$VITE_CHIRPSTACK_API_TOKEN" \
    --build-arg VITE_CHIRPSTACK_APPLICATION_ID="$VITE_CHIRPSTACK_APPLICATION_ID" \
    --build-arg VITE_CHIRPSTACK_DEVICE_PROFILE_ID="$VITE_CHIRPSTACK_DEVICE_PROFILE_ID" \
    .

# Run container
echo "Starting container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p $PORT:80 \
    $APP_NAME:latest

# Wait for container to be healthy
echo "Waiting for application to start..."
sleep 5

# Check container status
if docker ps | grep -q $CONTAINER_NAME; then
    echo ""
    echo "========================================"
    echo "✅ Deployment successful!"
    echo "========================================"
    echo "Application is running at:"
    echo "  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')"
    echo ""
    echo "Container logs:"
    docker logs --tail 20 $CONTAINER_NAME
    echo ""
    echo "To view logs: docker logs -f $CONTAINER_NAME"
    echo "To stop: docker stop $CONTAINER_NAME"
    echo "To restart: docker restart $CONTAINER_NAME"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Container logs:"
    docker logs $CONTAINER_NAME
    exit 1
fi