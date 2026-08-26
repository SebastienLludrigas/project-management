# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Kanban Studio: single-board Kanban MVP with an AI sidebar that can create/move/edit cards. Next.js static export served by a FastAPI backend, packaged in one Docker container on port 3000.

`AGENTS.md` at the repo root holds the business requirements, coding standards, and color scheme; per-directory `AGENTS.md` files (`backend/`, `frontend/`, `scripts/`) document each layer. `docs/PLAN.md` tracks the 10-part implementation plan (all parts complete); `docs/DATABASE.md` documents the schema.

## Commands

Docker (full app, frontend + backend on http://localhost:3000):
```bash
./scripts/start.sh     # builds image kanban-app:latest and runs container kanban-app
./scripts/stop.sh      # stops and removes the container
```
Windows equivalents: `scripts\start.bat`, `scripts\stop.bat`.

Backend (from `backend/`):
```bash
uv run pytest                                              # all tests
uv run pytest tests/test_board.py::test_get_board_seeds_initial_data   # single test
uv run uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

Frontend (from `frontend/`):
```bash
npm run test:unit                        # vitest (jsdom + Testing Library)
npm run test:unit -- src/lib/kanban.test.ts   # single file
npm run test:unit:watch
npm run test:e2e                         # playwright; auto-starts `next dev` on 127.0.0.1:3000 unless one is running
npm run lint
npm run build                            # static export into frontend/out
npm run dev                              # frontend only; /api calls will 404 without the backend
```

For local full-stack dev without Docker: `npm run build` in `frontend/`, then run uvicorn — `backend/main.py` picks up `frontend/out` automatically.

## Architecture

**Single-origin serving.** `backend/main.py` mounts static files at `/` from the first existing candidate: `$STATIC_DIR`, `frontend/out`, then `backend/static`. Because the SPA and API share an origin, the frontend calls relative paths (`/api/board`) with no base URL — there is no API host configuration anywhere.

**Board state is one JSON blob.** `BoardData = { columns: Column[], cards: Record<string, Card> }` — columns hold ordered `cardIds`, cards live in a flat map. This exact shape is duplicated in three places and must stay in sync: `frontend/src/lib/kanban.ts` (TS types + `initialData`), `backend/models.py` (Pydantic + `INITIAL_BOARD_DATA`), and the JSON schema embedded in the AI system prompt in `backend/ai.py`. The DB stores the whole board as a JSON string in `boards.data` (one row per user, `user_id UNIQUE`); there are no per-card rows. Every mutation therefore rewrites the entire board via `PUT /api/board`.

**Persistence flow.** `KanbanBoard.tsx` owns board state and has two save paths: `persistBoardNow` for discrete actions (drag, add, delete) and `persistBoardDebounced` (500 ms) for column renaming. Both share one `saveTimeoutRef`, so an immediate save cancels a pending debounced one.

**Auth.** Hardcoded `user`/`password` in `backend/auth.py`. Tokens are random hex kept in the in-process `ACTIVE_TOKENS` dict — they do not survive a backend restart, and every session is invalidated by one. The frontend stores the token in `localStorage` under `kanban_token` / `kanban_user`, and clears both on any 401 (see `frontend/src/lib/api.ts`).

**AI mutations.** `POST /api/ai/chat` injects the current board JSON into the system prompt and asks for `{ "message": ..., "board": ... | null }` via OpenRouter's `json_object` response format. If the model returns a board, the backend persists it server-side *and* returns it, and the sidebar pushes it up through `onBoardUpdate` so the UI reflects it without a refetch. `parse_structured_response` in `backend/ai.py` tolerates model sloppiness: code fences, truncated JSON, `cards` as an array instead of a map, columns carrying `cards` instead of `cardIds`. Only the last 20 chat messages are sent, and `max_tokens` is 4096 to leave headroom as the board (echoed back in full on every mutation) grows. Model is `deepseek/deepseek-v4-flash-0731:nitro` (`DEFAULT_MODEL` in `backend/ai.py`).

## Configuration

`OPENROUTER_API_KEY` in the root `.env` (loaded by both `main.py` and `ai.py`, from root then `backend/.env`); `./scripts/start.sh` passes it to the container via `--env-file`. `DATABASE_PATH` overrides the DB location, which defaults to `data/kanban.db` at repo root — backend tests set it to a `tmp_path` via an autouse fixture, so always add that fixture to new backend test files that touch the DB. Note the container has no volume mount: board data is lost when the container is removed.

## Conventions

- No emojis anywhere, including commit messages and docs.
- Keep it simple; no defensive programming or features beyond what was asked.
- User-facing strings (AI errors, chat responses) are in French; code, comments, and identifiers are in English.
- Diagnose root cause with evidence before fixing; do not guess.
- Update the relevant `AGENTS.md` and `docs/PLAN.md` checkboxes when changing a layer's structure.
