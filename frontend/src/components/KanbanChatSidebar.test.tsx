import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanChatSidebar } from "@/components/KanbanChatSidebar";
import { initialData } from "@/lib/kanban";

describe("KanbanChatSidebar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("kanban_token", "test-token");
  });

  it("renders assistant header, greeting message, and suggestion chips when open", () => {
    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("AI Board Assistant")).toBeInTheDocument();
    expect(screen.getByText(/Bonjour ! Je suis votre assistant IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Ajoute une carte 'Tests QA' dans Review/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("AI Board Assistant")).not.toBeInTheDocument();
  });

  it("sends user message and receives assistant response with board update", async () => {
    const handleBoardUpdate = vi.fn();
    const modifiedBoard = {
      ...initialData,
      cards: {
        ...initialData.cards,
        "card-ai-1": {
          id: "card-ai-1",
          title: "AI Card",
          details: "Created via chat",
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: "J'ai créé la carte AI Card.",
        board: modifiedBoard,
      }),
    });

    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={handleBoardUpdate}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/demander à l'ia/i);
    await userEvent.type(input, "Ajoute une carte");
    await userEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText("J'ai créé la carte AI Card.")).toBeInTheDocument();
      expect(handleBoardUpdate).toHaveBeenCalledWith(modifiedBoard);
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={vi.fn()}
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeButton = screen.getByRole("button", { name: /fermer le chat/i });
    await userEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalled();
  });

  it("renders structured markdown with bold highlights and bullet points", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: "Voici le résumé :\n- **Tâche 1** en cours\n- **Tâche 2** terminée",
        board: null,
      }),
    });

    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/demander à l'ia/i);
    await userEvent.type(input, "Résumé");
    await userEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText("Voici le résumé :")).toBeInTheDocument();
      expect(screen.getByText("Tâche 1")).toBeInTheDocument();
      expect(screen.getByText("Tâche 2")).toBeInTheDocument();
    });
  });

  it("safely cleans and extracts message if API returns a raw JSON string", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: '{"message": "Carte QA ajoutée avec succès.", "board": null}',
        board: null,
      }),
    });

    render(
      <KanbanChatSidebar
        board={initialData}
        onBoardUpdate={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/demander à l'ia/i);
    await userEvent.type(input, "Ajoute QA");
    await userEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText("Carte QA ajoutée avec succès.")).toBeInTheDocument();
      expect(screen.queryByText(/{"message"/i)).not.toBeInTheDocument();
    });
  });
});
