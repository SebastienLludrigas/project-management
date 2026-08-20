# Lifecycle Scripts

This directory contains cross-platform scripts to build, run, and stop the Kanban application container.

## Available Scripts

- `start.sh` (Mac / Linux): Builds the Docker image `kanban-app:latest`, stops any existing container, and runs the container in background on port 3000.
- `stop.sh` (Mac / Linux): Stops and removes the `kanban-app` container.
- `start.bat` (Windows): Builds and starts the Docker container on port 3000.
- `stop.bat` (Windows): Stops and removes the Docker container.

## Usage

```bash
# Start container
./scripts/start.sh

# Stop container
./scripts/stop.sh
```