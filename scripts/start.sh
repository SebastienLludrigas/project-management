#!/bin/bash
set -e

# Ensure common binary paths are available
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Change to project root directory
cd "$(dirname "$0")/.."

CONTAINER_NAME="kanban-app"
IMAGE_NAME="kanban-app:latest"
PORT=3000

echo "Building Docker image ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}" .

# Stop existing container if running
if [ "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Stopping existing container ${CONTAINER_NAME}..."
    docker stop "${CONTAINER_NAME}" >/dev/null
fi

if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Removing existing container ${CONTAINER_NAME}..."
    docker rm "${CONTAINER_NAME}" >/dev/null
fi

ENV_FLAG=""
if [ -f ".env" ]; then
    ENV_FLAG="--env-file .env"
fi

mkdir -p "$(pwd)/data"

echo "Starting container ${CONTAINER_NAME} on port ${PORT}..."
docker run -d --name "${CONTAINER_NAME}" -p "${PORT}:${PORT}" -v "$(pwd)/data:/app/data" ${ENV_FLAG} "${IMAGE_NAME}"

echo "Application started successfully at http://localhost:${PORT}"
