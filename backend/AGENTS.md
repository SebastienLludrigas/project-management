# Backend Architecture and Guidelines

## Overview
The backend is built with Python 3.12+, FastAPI, and `uv` as the package manager. It serves the REST API endpoints and static frontend assets at `/` on port 3000.

## Structure
```
backend/
├── main.py              # FastAPI application entry point and static mount
├── pyproject.toml       # Dependencies managed with uv (package = false)
├── README.md            # Minimal backend documentation
├── static/              # Scaffolding static assets (fallback index.html)
│   └── index.html
└── tests/
    └── test_health.py   # Pytest suite for health endpoint and static serving
```

## Running & Testing

- Run tests:
  `uv run pytest`
- Run local dev server:
  `uv run uvicorn main:app --host 0.0.0.0 --port 3000 --reload`

## Endpoints

- `GET /api/health` - Basic health check returning `{"status": "ok"}`
- `GET /` - Serves static application frontend