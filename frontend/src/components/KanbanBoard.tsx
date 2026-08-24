"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { KanbanChatSidebar } from "@/components/KanbanChatSidebar";
import { LoginForm } from "@/components/LoginForm";
import { fetchBoard, saveBoard } from "@/lib/api";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBoardData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const data = await fetchBoard();
      setBoard(data);
      setSyncError(null);
    } catch {
      setSyncError("Failed to load board");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("kanban_token");
    const storedUser = localStorage.getItem("kanban_user");
    if (token) {
      setIsAuthenticated(true);
      setUsername(storedUser || "user");
      loadBoardData();
    }
    setIsInitializing(false);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [loadBoardData]);

  // Immediate save for discrete actions (drag, add card, delete card)
  const persistBoardNow = async (newBoard: BoardData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setBoard(newBoard);
    try {
      setIsSyncing(true);
      await saveBoard(newBoard);
      setSyncError(null);
    } catch {
      setSyncError("Failed to save changes");
    } finally {
      setIsSyncing(false);
    }
  };

  // Debounced save for high-frequency text changes (e.g. column title renaming)
  const persistBoardDebounced = (newBoard: BoardData, delay = 500) => {
    setBoard(newBoard);
    setIsSyncing(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveBoard(newBoard);
        setSyncError(null);
      } catch {
        setSyncError("Failed to save changes");
      } finally {
        setIsSyncing(false);
      }
    }, delay);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleLoginSuccess = (_token: string, user: string) => {
    setIsAuthenticated(true);
    setUsername(user);
    loadBoardData();
  };

  const handleLogout = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const token = localStorage.getItem("kanban_token");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network error on logout
      }
    }
    localStorage.removeItem("kanban_token");
    localStorage.removeItem("kanban_user");
    setIsAuthenticated(false);
    setUsername("");
  };

  const handleAIBoardUpdate = (updatedBoard: BoardData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setBoard(updatedBoard);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const nextColumns = moveCard(
      board.columns,
      active.id as string,
      over.id as string
    );
    const updatedBoard = { ...board, columns: nextColumns };
    persistBoardNow(updatedBoard);
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    const updatedBoard = {
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    };
    persistBoardDebounced(updatedBoard, 500);
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    const updatedBoard = {
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    };
    persistBoardNow(updatedBoard);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    const updatedBoard = {
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    };
    persistBoardNow(updatedBoard);
  };

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden min-h-screen">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main
        className={`relative mx-auto flex min-h-screen flex-col gap-10 px-6 pb-16 pt-12 transition-all duration-300 ${
          isChatOpen ? "max-w-[1500px] xl:pr-[440px]" : "max-w-[1500px]"
        }`}
      >
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and collaborate with the integrated AI assistant.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-[var(--gray-text)]">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSyncing
                        ? "bg-[var(--accent-yellow)] animate-pulse"
                        : syncError
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  {isSyncing ? "Saving..." : syncError ? syncError : "Synced"}
                </span>
                <span className="text-xs text-[var(--gray-text)]">|</span>
                <span className="text-xs text-[var(--gray-text)]">
                  Signed in as <strong className="text-[var(--navy-dark)]">{username}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary-purple)] transition hover:border-[var(--secondary-purple)]"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm transition ${
                    isChatOpen
                      ? "border-[var(--primary-blue)] bg-[var(--primary-blue)] text-white"
                      : "border-[var(--stroke)] bg-white text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                  AI Assistant
                </button>
              </div>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="flex gap-6 overflow-x-auto pb-6 pt-2 snap-x 2xl:grid 2xl:grid-cols-5 2xl:overflow-x-visible">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <KanbanChatSidebar
        board={board}
        onBoardUpdate={handleAIBoardUpdate}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};
