#!/bin/bash
# 롤백 스크립트
set -e

APP_NAME=${1:-cloudwatch-viewer}
PREVIOUS_TAG=${2}
INSTALL_DIR="/opt/aws-internal"

if [ -z "$PREVIOUS_TAG" ]; then
    echo "Usage: ./rollback.sh <app-name> <previous-tag>"
    echo ""
    echo "Example:"
    echo "  ./rollback.sh cloudwatch-viewer abc1234"
    exit 1
fi

cd $INSTALL_DIR

echo "=== Rolling back $APP_NAME to $PREVIOUS_TAG ==="

TAG=$PREVIOUS_TAG docker compose up -d $APP_NAME

sleep 10
docker compose ps $APP_NAME

echo "=== Rollback to $PREVIOUS_TAG complete ==="
