# Stage 1: Build the static Next.js frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python FastAPI backend with static files
FROM python:3.12-slim-bookworm

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency definition
COPY backend/pyproject.toml backend/README.md /app/backend/

# Install python dependencies
WORKDIR /app/backend
RUN uv sync --no-dev

# Copy backend application source
COPY backend /app/backend

# Copy static frontend export from stage 1
COPY --from=frontend-builder /app/frontend/out /app/frontend/out

# Expose port 3000
EXPOSE 3000
ENV PORT=3000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
