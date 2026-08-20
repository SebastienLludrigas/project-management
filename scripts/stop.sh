#!/bin/bash
set -e

# Ensure common binary paths are available
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

CONTAINER_NAME="kanban-app"

if [ "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Stopping container ${CONTAINER_NAME}..."
    docker stop "${CONTAINER_NAME}" >/dev/null
fi

if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Removing container ${CONTAINER_NAME}..."
    docker rm "${CONTAINER_NAME}" >/dev/null
fi

echo "Application container ${CONTAINER_NAME} stopped and removed."
