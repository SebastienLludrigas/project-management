# Kanban Studio - AI-Powered Project Management MVP

A single-board Kanban web application with an integrated AI assistant capable of creating, moving, and editing task cards.

## Features

- **Authentication**: Single user sign-in (`user` / `password`) with Bearer token authentication.
- **Kanban Board**: 5 columns with drag-and-drop card movement, card creation/deletion, and debounced column renaming.
- **AI Assistant**: Sidebar chat powered by DeepSeek (`deepseek/deepseek-v4-flash-0731:nitro`) via OpenRouter, with structured outputs that directly modify the board.
- **Persistence**: Embedded SQLite database automatically persisting all user and AI board updates.
- **Containerized**: Unified Docker container packaging the Next.js static export and FastAPI backend.

## Requirements

- Docker
- Node.js 20+ (for local frontend development)
- Python 3.12+ and uv (for local backend development)
- OpenRouter API key in `.env` (`OPENROUTER_API_KEY=...`)

## Getting Started

### Using Docker (Recommended)

Start the application:
```bash
./scripts/start.sh
```

The web application will be available at http://localhost:3000.

Stop the application:
```bash
./scripts/stop.sh
```

On Windows, use `scripts\start.bat` and `scripts\stop.bat`.

## Testing

### Unit and Integration Tests

Run frontend unit tests:
```bash
cd frontend && npm run test:unit
```

Run backend unit and integration tests:
```bash
cd backend && uv run pytest
```

### End-to-End Tests

With the application running (via `./scripts/start.sh`):
```bash
cd frontend && npm run test:e2e
```

## Architecture

- **Frontend**: Next.js (App Router, Static Export), Tailwind CSS, @dnd-kit.
- **Backend**: Python FastAPI, SQLite (persisted at `data/kanban.db`), OpenRouter AI client.
- **Docker**: Multi-stage build (Node build stage + Python runtime stage).
