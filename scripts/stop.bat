@echo off
setlocal

set CONTAINER_NAME=kanban-app

docker ps -q -f name=^/%CONTAINER_NAME%$ > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Stopping container %CONTAINER_NAME%...
    docker stop %CONTAINER_NAME% > nul 2>&1
)

docker ps -aq -f name=^/%CONTAINER_NAME%$ > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Removing container %CONTAINER_NAME%...
    docker rm %CONTAINER_NAME% > nul 2>&1
)

echo Application container %CONTAINER_NAME% stopped and removed.
endlocal
