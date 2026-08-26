@echo off
setlocal

cd /d "%~dp0\.."

set CONTAINER_NAME=kanban-app
set IMAGE_NAME=kanban-app:latest
set PORT=3000

echo Building Docker image %IMAGE_NAME%...
docker build -t %IMAGE_NAME% .

docker ps -q -f name=^/%CONTAINER_NAME%$ > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Stopping existing container %CONTAINER_NAME%...
    docker stop %CONTAINER_NAME% > nul 2>&1
)

docker ps -aq -f name=^/%CONTAINER_NAME%$ > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Removing existing container %CONTAINER_NAME%...
    docker rm %CONTAINER_NAME% > nul 2>&1
)

set ENV_FLAG=
if exist .env (
    set ENV_FLAG=--env-file .env
)

if not exist data mkdir data

echo Starting container %CONTAINER_NAME% on port %PORT%...
docker run -d --name %CONTAINER_NAME% -p %PORT%:%PORT% -v "%cd%\data:/app/data" %ENV_FLAG% %IMAGE_NAME%

echo Application started successfully at http://localhost:%PORT%
endlocal
