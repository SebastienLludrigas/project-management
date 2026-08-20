# Frontend Architecture and Guidelines

## Overview
The frontend is a single-page Kanban board web application built with Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, and `@dnd-kit`.

## Component Hierarchy & Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── globals.css         # Design tokens, CSS variables, and global reset
│   │   ├── layout.tsx          # Root layout defining fonts (Outfit & Plus Jakarta Sans)
│   │   └── page.tsx            # Main page mounting KanbanBoard
│   ├── components/
│   │   ├── KanbanBoard.tsx     # Root Kanban container, DnD context, state & event orchestration
│   │   ├── KanbanColumn.tsx    # Droppable column container, editable title, sortable cards list
│   │   ├── KanbanCard.tsx      # Draggable card item with useSortable and delete action
│   │   ├── KanbanCardPreview.tsx # Drag overlay visual representation
│   │   ├── NewCardForm.tsx     # Inline form to create cards per column
│   │   └── KanbanBoard.test.tsx# Unit tests for KanbanBoard component
│   ├── lib/
│   │   ├── kanban.ts           # Types (Card, Column, BoardData), initialData, moveCard logic
│   │   └── kanban.test.ts      # Unit tests for kanban helper functions
│   └── test/
│       ├── setup.ts            # Vitest environment setup
│       └── vitest.d.ts         # TypeScript definitions for Vitest
├── tests/
│   └── kanban.spec.ts          # Playwright end-to-end test suite
├── next.config.ts              # Next.js configuration (configured for static export)
├── package.json                # Dependencies and npm scripts
├── playwright.config.ts        # Playwright test configuration
└── vitest.config.ts            # Vitest test configuration
```

## Data Types & Models (`src/lib/kanban.ts`)

- `Card`: `{ id: string; title: string; details: string; }`
- `Column`: `{ id: string; title: string; cardIds: string[]; }`
- `BoardData`: `{ columns: Column[]; cards: Record<string, Card>; }`

## Design System & Color Palette

Tokens defined in `src/app/globals.css`:
- Accent Yellow: `--accent-yellow: #ecad0a` (badges, focus rings, accents)
- Primary Blue: `--primary-blue: #209dd7` (links, key highlights)
- Secondary Purple: `--secondary-purple: #753991` (call-to-actions, submit buttons)
- Dark Navy: `--navy-dark: #032147` (headings, body foreground)
- Gray Text: `--gray-text: #888888` (subtitles, placeholders, labels)

## Testing Strategy

- Unit / Integration Tests:
  `npm run test:unit` executes Vitest with jsdom and React Testing Library.
- E2E Tests:
  `npm run test:e2e` executes Playwright tests against the running server.
- All Tests:
  `npm run test:all` executes both suites sequentially.

## Target Integration Path
1. Enable `output: 'export'` in `next.config.ts` for static generation into `out/`.
2. Add Bearer token authentication guard (`user` / `password`).
3. Connect state to backend REST endpoints (`GET /api/board`, `PUT /api/board`).
4. Integrate the AI Chat Sidebar widget (`POST /api/ai/chat`) with automatic Kanban board updates.
