#!/bin/bash
# 배포 스크립트
set -e

APP_NAME=${1:-cloudwatch-viewer}
IMAGE_TAG=${2:-latest}
INSTALL_DIR="/opt/aws-internal"

cd $INSTALL_DIR

echo "=== Deploying $APP_NAME:$IMAGE_TAG ==="

# Pull & Start
TAG=$IMAGE_TAG docker compose pull $APP_NAME
TAG=$IMAGE_TAG docker compose up -d $APP_NAME

# Wait & Verify
echo "Waiting for container to start..."
sleep 10
docker compose ps $APP_NAME

# Cleanup old images
docker image prune -f

echo "=== Deploy complete ==="
