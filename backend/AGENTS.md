# Backend Architecture and Guidelines

## Overview
The backend is built with Python 3.12+, FastAPI, and `uv` as the package manager. It serves the REST API endpoints and static frontend assets at `/` on port 3000.

## Structure
```
backend/
├── ai.py                # AI service using OpenRouter DeepSeek with structured output
├── auth.py              # Bearer token authentication routes and dependency
├── board.py             # Kanban board CRUD router
├── database.py          # SQLite database connection, initialization, and models
├── main.py              # FastAPI application entry point and static mount
├── models.py            # Pydantic schemas for Card, Column, Board, and Chat
├── pyproject.toml       # Dependencies managed with uv (package = false)
├── README.md            # Minimal backend documentation
├── static/              # Static frontend fallback assets
└── tests/
    ├── test_ai_chat.py        # Tests for AI chat endpoint and board mutations
    ├── test_ai_connectivity.py# Tests for OpenRouter connectivity
    ├── test_auth.py           # Tests for user authentication and login rate limiting
    ├── test_board.py          # Tests for Kanban board CRUD and persistence
    └── test_health.py         # Tests for health endpoint and static serving
```

## Login rate limiting

`POST /api/auth/login` tracks failed attempts per client IP in-memory (`FAILED_LOGIN_ATTEMPTS` in `auth.py`). After `MAX_FAILED_LOGIN_ATTEMPTS` (5) failures within `FAILED_LOGIN_WINDOW_SECONDS` (60), further attempts from that IP get `429 Too Many Requests` until the window rolls over. Like `ACTIVE_TOKENS`, this state is in-memory and resets on restart.

## Board referential integrity

`BoardData` in `models.py` validates that every `cardId` referenced by a column exists in `cards` (see `docs/DATABASE.md`). This applies to both `PUT /api/board` and AI-generated boards.

## Running & Testing

- Run tests:
  `uv run pytest`
- Run local dev server:
  `uv run uvicorn main:app --host 0.0.0.0 --port 3000 --reload`

## Endpoints

- `GET /api/health` - Basic health check returning `{"status": "ok"}`
- `POST /api/auth/login` - Authenticate user and issue Bearer token
- `POST /api/auth/logout` - Revoke session
- `GET /api/board` - Fetch authenticated user's board
- `PUT /api/board` - Persist updated board
- `POST /api/ai/test` - Test OpenRouter connectivity
- `POST /api/ai/chat` - AI assistant chat and automated board modifications
- `GET /` - Serves static application frontend