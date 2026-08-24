# High Level Steps for Project

This document outlines the 10-part implementation plan for the Project Management MVP web application. Each part contains detailed actionable substeps, testing procedures, and unambiguous success criteria.

---

## Part 1: Plan & Frontend Documentation

Enrich project documentation and document the frontend architecture.

### Substeps
- [x] Create `frontend/AGENTS.md` describing existing components, data models, styling tokens, and test suites.
- [x] Enrich `docs/PLAN.md` with complete checklists, test commands, and success criteria for all 10 parts.
- [x] Review and obtain user approval for the detailed plan.

### Testing & Verification
- Verify all links in markdown files resolve properly.
- Ensure coding standards (no emojis, concise language, clear paths) are respected.

### Success Criteria
- `frontend/AGENTS.md` and `docs/PLAN.md` are up to date and approved.

---

## Part 2: Scaffolding (Backend, Docker, Scripts)

Set up the Docker infrastructure, the FastAPI backend in `backend/` using `uv`, and start/stop scripts in `scripts/`.

### Substeps
- [x] Initialize Python backend environment in `backend/` using `uv` (`pyproject.toml` with `fastapi`, `uvicorn`, `pydantic`, `httpx`, `pytest`).
- [x] Create basic FastAPI application in `backend/main.py` with `GET /api/health` endpoint and static file mount for testing.
- [x] Write `Dockerfile` setting up Python, `uv`, port 3000 exposure, and FastAPI server command.
- [x] Create cross-platform lifecycle scripts in `scripts/`:
  - `scripts/start.sh` and `scripts/stop.sh` (Mac / Linux)
  - `scripts/start.bat` and `scripts/stop.bat` (Windows)
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md` to document implementation details.

### Testing & Verification
- Unit test: Run `pytest` in `backend/` to verify `GET /api/health`.
- Integration test: Run `./scripts/start.sh` (or `docker build` / `docker run`) and execute `curl http://localhost:3000/api/health`.
- Run `./scripts/stop.sh` and confirm clean shutdown.

### Success Criteria
- Container builds and runs cleanly on port 3000.
- Health endpoint returns `{"status": "ok"}` via HTTP.

---

## Part 3: Add in Frontend Static Build & Serving

Build the Next.js frontend statically and serve it from the FastAPI backend at `/`.

### Substeps
- [x] Configure `frontend/next.config.ts` with `output: 'export'` and `images: { unoptimized: true }`.
- [x] Update `Dockerfile` to use a multi-stage build: Stage 1 builds the static export (`frontend/out`), Stage 2 copies `out/` into FastAPI static directory.
- [x] Configure FastAPI in `backend/main.py` to serve static assets and fallback to `index.html` at `/`.
- [x] Update scripts if necessary to support local dev build and containerized runtime.

### Testing & Verification
- Run `npm run build` in `frontend/` to ensure clean static export without errors.
- Run frontend unit tests: `npm run test:unit`.
- Start container and visit `http://localhost:3000/` to verify full Kanban board loads and renders 5 columns.

### Success Criteria
- The Kanban UI renders fully at `http://localhost:3000/` without any 404 or missing asset errors.
- Vitest unit tests pass 100%.

---

## Part 4: Add in a Fake User Sign-in Experience

Implement authentication requiring dummy credentials (`user` / `password`) returning a Bearer token.

### Substeps
- [x] Create auth router in `backend/auth.py` with `POST /api/auth/login` validating `user` / `password` and issuing a Bearer token.
- [x] Add dependency in FastAPI to validate Bearer token for protected endpoints.
- [x] Create login component / screen in frontend matching the design tokens (`#032147`, `#209dd7`, `#753991`, `#ecad0a`).
- [x] Store Bearer token in client state (`localStorage`) and add a logout button in the header.
- [x] Guard the Kanban board so unauthenticated users see the login screen first.

### Testing & Verification
- Backend tests: `pytest` verifying valid credentials return a token, invalid credentials return 401.
- Frontend tests: Vitest test verifying login form validation and state toggle.
- E2E Playwright test: Verifying full login flow, accessing board, and logout.

### Success Criteria
- Unauthenticated access prompts for login.
- Valid login with `user` / `password` displays the Kanban board.
- Logout revokes access and returns to login view.

---

## Part 5: Database Modeling

Design SQLite database schema for persisting users and the Kanban board JSON structure.

### Substeps
- [x] Design SQLite schema with `users` and `boards` tables (storing `user_id`, board JSON `data`, and timestamps).
- [x] Document the schema, migrations, and data guarantees in `docs/DATABASE.md`.
- [x] Confirm alignment with frontend `BoardData` structure (`columns`, `cards`).

### Testing & Verification
- Validate schema constraints with SQLite script / test fixtures.
- Verify serialization and deserialization against `initialData`.

### Success Criteria
- `docs/DATABASE.md` created with documented schema and approved.

---

## Part 6: Backend Kanban CRUD API

Implement FastAPI routes to read and update the Kanban board for authenticated users.

### Substeps
- [x] Create SQLite database helper in `backend/database.py` with auto-creation of database file and tables on startup.
- [x] Implement `GET /api/board` returning the authenticated user's board (auto-seeded with default data if empty).
- [x] Implement `PUT /api/board` updating the authenticated user's board state.
- [x] Add Pydantic models for validation of `Card`, `Column`, and `BoardData`.

### Testing & Verification
- Write comprehensive `pytest` test suite in `backend/tests/test_board.py` testing DB initialization, default seed, fetch, update, and auth protection.

### Success Criteria
- All backend board tests pass.
- Database file is auto-created when absent.

---

## Part 7: Frontend + Backend Integration

Connect the frontend React components to the FastAPI backend API for persistent Kanban management.

### Substeps
- [x] Create API client service in `frontend/src/lib/api.ts` handling Bearer token injection and error handling.
- [x] Update `KanbanBoard.tsx` to load board data from `GET /api/board` upon authentication.
- [x] Sync board updates (`PUT /api/board`) on card drag-and-drop, column rename, card creation, and card deletion.
- [x] Add subtle loading and error feedback states in the UI.

### Testing & Verification
- Run `npm run test:unit` to verify updated React hooks/components.
- Run Playwright E2E tests: Perform changes, reload the browser, and assert changes persist.

### Success Criteria
- All board manipulations persist in SQLite and survive browser refreshes.

---

## Part 8: AI Connectivity via OpenRouter

Establish and verify communication with OpenRouter using the `deepseek/deepseek-v4-flash-0731` model.

### Substeps
- [ ] Create AI service client in `backend/ai.py` utilizing `OPENROUTER_API_KEY` from `.env`.
- [ ] Configure target model `deepseek/deepseek-v4-flash-0731` with OpenRouter endpoint `https://openrouter.ai/api/v1/chat/completions`.
- [ ] Implement a verification endpoint `POST /api/ai/test` executing a basic prompt (e.g., "2+2").
- [ ] Write backend unit test verifying OpenRouter API response handling.

### Testing & Verification
- Run `pytest` targeting `test_ai_connectivity.py` with valid API key.
- Verify status 200 and proper answer parsing.

### Success Criteria
- FastAPI successfully communicates with OpenRouter and receives a valid response from the DeepSeek model.

---

## Part 9: AI Structured Outputs & Board Mutations

Enable the backend AI endpoint to receive board JSON + conversation history, returning structured responses with optional board mutations.

### Substeps
- [ ] Define Structured Output Pydantic schemas for the AI response:
  - `message`: Assistant conversational response.
  - `board`: Optional updated `BoardData` object reflecting requested modifications.
- [ ] Build system prompt enforcing schema adherence, preserving existing cards/columns unless instructed, and applying board operations.
- [ ] Implement `POST /api/ai/chat` endpoint taking `{ messages: [...], board: BoardData }`.
- [ ] Automatically persist updated board in SQLite if the AI returns an updated board state.

### Testing & Verification
- Unit test AI output parsing with mock JSON payloads and live test cases (e.g., "Add card 'Deploy' to Review").
- Verify that invalid structured formats are safely caught and handled.

### Success Criteria
- AI returns structured conversational replies and accurate board modifications when requested.

---

## Part 10: Beautiful AI Chat Sidebar & Dynamic Kanban Refresh

Add a sleek AI chat sidebar to the web app with real-time Kanban board updates.

### Substeps
- [ ] Create `KanbanChatSidebar.tsx` matching the design system (`#ecad0a`, `#209dd7`, `#753991`, `#032147`, `#888888`).
- [ ] Implement chat conversation UI: message thread, input box, loading spinner, and quick suggestion prompts.
- [ ] Wire sidebar to `POST /api/ai/chat` and update parent `KanbanBoard` state immediately when AI modifies the board.
- [ ] Update documentation (`README.md`, `docs/`, `AGENTS.md` files) to reflect the finished MVP.

### Testing & Verification
- Run full test suite: `npm run test:all` and `pytest`.
- Run end-to-end Playwright tests simulating user chat prompts and verifying instant Kanban UI updates.
- Test container build and run via `./scripts/start.sh`.

### Success Criteria
- Clean, responsive UI with interactive AI chat sidebar.
- AI board updates reflect instantly on screen without manual refresh.
- Complete test suites pass across frontend, backend, and Docker container.