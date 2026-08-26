# Code Review - Kanban Studio

Date: 2026-08-26
Scope: entire repo (`backend/`, `frontend/`, `scripts/`, `Dockerfile`, docs)
Method: full read-through of the source files, running the existing test suites (`uv run pytest`, `npm run test:unit`, `npm run lint`)

## Summary

The application is a clean MVP Kanban board consistent with the spec in `AGENTS.md`. The structure faithfully follows the contract documented in `CLAUDE.md` (one JSON blob for the board, duplicated in three places, single-origin serving). The code is clean and free of over-engineering, and the existing test suite passes in full:

- Backend: `uv run pytest` -> 16/16 tests passing (17/17 after Action 5's new test)
- Frontend unit: `npm run test:unit` -> 17/17 tests passing (26/26 after Action 6's new tests)
- Frontend lint: `npm run lint` -> 1 error (see Action 1; 0 errors after the fix)

The most significant finding is not an active bug but a missing safeguard: nothing enforces that `columns[].cardIds` stays consistent with `cards`, neither on the backend (Pydantic) nor on the frontend at save time. Since the board is a single blob rewritten wholesale by both the PUT endpoint and the AI (which generates JSON freely), this is the most likely point of silent data corruption.

**Update (2026-08-26): all 8 actions below have been implemented.** See the Status column in the Action summary table.

## Findings and actions

### 1. Frontend lint failure (blocking if lint is a CI gate)

`frontend/tests/kanban.spec.ts:3`:
```ts
const login = async (page: any) => {
```
`npm run lint` fails with `Unexpected any. Specify a different type`.

**Action**: type it with `Page` imported from `@playwright/test`:
```ts
import { expect, test, type Page } from "@playwright/test";
const login = async (page: Page) => { ... }
```

### 2. No referential integrity check on `BoardData`

`backend/models.py` accepts any combination of `columns[].cardIds` and `cards` with no cross-field validation. Two paths feed this model with untrusted data:
- `PUT /api/board` (`backend/board.py`) accepts the board as-is.
- The AI response (`backend/ai.py:181-184`) only validates basic Pydantic shape, not consistency.

Possible consequences: a `cardId` referenced in a column with no matching entry in `cards` (ghost card), the same card present in two columns at once (visual duplication), or an orphan card in `cards` that never appears in any column.

On the frontend, `KanbanBoard.tsx:315` silently hides the symptom:
```ts
cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
```
This `filter(Boolean)` avoids a crash but hides the inconsistency instead of surfacing it; ghost cards disappear without a trace and without persisting any fix to the database.

**Action**: add a `model_validator(mode="after")` on `BoardData` in `backend/models.py` that checks every `cardId` in every column exists in `cards`, raising a validation error otherwise (rejects the PUT, and makes `parse_structured_response` fall back to `validated_board = None` for malformed AI responses, which is already handled). Document the expected behavior (orphan cards allowed or not) in `docs/DATABASE.md`.

### 3. Silent failure when validating the AI-generated board

`backend/ai.py:181-184`:
```python
try:
    validated_board = BoardData.model_validate(board_data)
except Exception:
    validated_board = None
```
If the LLM returns a `board` whose accompanying `message` announces a change ("card added to Review") but whose JSON `board` fails Pydantic validation, the user gets a confirmation message even though nothing actually changed in the database. Nothing is logged for this specific case (unlike the other error branches in this file, which do use `print(...)`).

**Action**: log the exception (`print(f"[AI Chat] board validation failed: {exc}")`) to enable diagnosis, and consider returning a message consistent with the failure instead of the model's raw message when `validated_board is None` but the model claimed a modification.

### 4. Permissive CORS combined with `allow_credentials=True`

`backend/main.py:29-35`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Authentication happens via a Bearer token in the `Authorization` header, never via cookies, so `allow_credentials=True` adds nothing here — it only matters for cookies/sessions. Combining a wildcard origin with credentials is a configuration to avoid on principle (the CORS spec forbids this combination for cookie-bearing requests, and Starlette silently fails to echo back `*` in that case).

**Action**: remove `allow_credentials=True` (useless for a Bearer token flow), or restrict `allow_origins` to the real serving origin if the credential flag must stay. Since the frontend and backend are served single-origin (per `CLAUDE.md`), CORS could arguably be dropped entirely for this app.

### 5. No rate limiting on `/api/auth/login`

`backend/auth.py:29-38` has no rate limiting. Credentials are intentionally hardcoded for the MVP (documented), but nothing prevents trivial brute forcing if the port is ever exposed beyond `localhost`. Low priority as long as the deployment stays strictly local, but worth addressing before any network exposure.

**Action**: if the service is ever made reachable beyond `localhost`, add basic throttling (e.g. per-IP limit) before going further.

### 6. Incomplete frontend unit test coverage on presentational components

Only `KanbanBoard.test.tsx`, `KanbanChatSidebar.test.tsx`, `LoginForm.test.tsx`, and `kanban.test.ts` exist. `KanbanColumn.tsx`, `KanbanCard.tsx`, `NewCardForm.tsx`, and `KanbanCardPreview.tsx` are only tested indirectly through `KanbanBoard.test.tsx` and the Playwright e2e tests. Column renaming, card deletion, and the add-card form validation (`NewCardForm.tsx:15-17`, required title) have no isolated unit test.

**Action**: add targeted tests for `NewCardForm` (blocked submission with empty title, reset after add) and `KanbanColumn` (empty-state "Drop a card here" rendering, `onDeleteCard` call). Low priority, since behavior is already covered end-to-end by Playwright.

### 7. The payload sent to `/api/ai/chat` grows unbounded on the client

`frontend/src/components/KanbanChatSidebar.tsx:204` sends the entire `updatedMessages` history (never trimmed client-side) on every call, even though `backend/ai.py:238` only keeps the last 10 messages for the LLM. Over a very long chat session, the request payload grows needlessly since the backend discards most of what it receives.

**Action**: trim `messages` on the client before the call (e.g. `messages.slice(-10)` in `sendAIChatMessage` or in `KanbanChatSidebar`), which also avoids duplicating the magic number `10` between frontend and backend without either side being aware of the other.

### 8. No Docker volume for SQLite persistence

`scripts/start.sh:34` runs the container without `-v`, and `CLAUDE.md` already documents explicitly that data is lost when the container is removed. This is not a bug (intended MVP behavior), but it is an easy gap to close if persistence across restarts becomes a real need for a project management tool.

**Action (optional)**: if persistence should survive `./scripts/stop.sh` + `./scripts/start.sh`, add `-v "$(pwd)/data:/app/data"` (and the equivalent in `start.bat`) instead of leaving data inside the container.

## Positive notes

- No use of `dangerouslySetInnerHTML`: the Markdown-like rendering of AI chat messages (`KanbanChatSidebar.tsx`) builds React elements (`renderInline`), so there is no XSS vector via LLM responses even though the LLM is user-influenceable.
- All SQL queries are parameterized (`database.py`), so SQL injection is not possible.
- `parse_structured_response` (`backend/ai.py`) is robust against known LLM sloppiness (code fences, truncated JSON, `cards` as an array, missing `cardIds`) — a good example of defensive handling that is **justified** by a documented real need, unlike gratuitous defensive programming.
- `.env` is never copied into the Docker image (absent from the `Dockerfile`, only passed via `--env-file` at runtime) and stays out of version control (`.gitignore`). Good secret hygiene.
- The backend test suite covers 401s on all protected routes, SQLite persistence, and degraded AI parsing — a solid confidence level for an MVP.

## Action summary

| # | Priority | File | Action | Status |
|---|----------|------|--------|--------|
| 1 | High | `frontend/tests/kanban.spec.ts` | Replace `any` with the `Page` type to fix the lint failure | Done |
| 2 | High | `backend/models.py` | Add referential integrity validation between `cardIds` and `cards` on `BoardData` | Done |
| 3 | Medium | `backend/ai.py` | Log AI board validation failures instead of swallowing them silently | Done |
| 4 | Medium | `backend/main.py` | Remove or restrict `allow_credentials=True` combined with `allow_origins=["*"]` | Done |
| 5 | Low | `backend/auth.py` | Rate limit `/api/auth/login` if exposed beyond `localhost` | Done |
| 6 | Low | `frontend/src/components/` | Add unit tests for `NewCardForm` and `KanbanColumn` | Done |
| 7 | Low | `frontend/src/components/KanbanChatSidebar.tsx` | Trim the chat history sent to the API instead of sending everything | Done |
| 8 | Optional | `scripts/start.sh` / `start.bat` | Add a Docker volume for SQLite persistence if needed | Done |
