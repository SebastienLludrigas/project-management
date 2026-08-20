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

# Expose port 3000
EXPOSE 3000
ENV PORT=3000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
