import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import type { Card, Column } from "@/lib/kanban";

const column: Column = {
  id: "col-backlog",
  title: "Backlog",
  cardIds: ["card-1", "card-2"],
};

const cards: Card[] = [
  { id: "card-1", title: "First card", details: "Details 1" },
  { id: "card-2", title: "Second card", details: "Details 2" },
];

// Matches the activation constraint used in KanbanBoard.tsx so a plain click
// (no pointer movement) does not get swallowed as a drag attempt.
const TestDndProvider = ({ children }: { children: React.ReactNode }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  return <DndContext sensors={sensors}>{children}</DndContext>;
};

const renderColumn = (props: Partial<React.ComponentProps<typeof KanbanColumn>> = {}) =>
  render(
    <TestDndProvider>
      <KanbanColumn
        column={column}
        cards={cards}
        onRename={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        {...props}
      />
    </TestDndProvider>
  );

describe("KanbanColumn", () => {
  it("renders the column title and card count", () => {
    renderColumn();
    expect(screen.getByLabelText("Column title")).toHaveValue("Backlog");
    expect(screen.getByText("2 cards")).toBeInTheDocument();
  });

  it("renders each card and no empty-state placeholder", () => {
    renderColumn();
    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(screen.getByText("Second card")).toBeInTheDocument();
    expect(screen.queryByText(/drop a card here/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state placeholder when there are no cards", () => {
    renderColumn({ column: { ...column, cardIds: [] }, cards: [] });
    expect(screen.getByText(/drop a card here/i)).toBeInTheDocument();
  });

  it("calls onRename when the title input changes", async () => {
    const onRename = vi.fn();
    renderColumn({ onRename });

    const input = screen.getByLabelText("Column title");
    await userEvent.type(input, "!");

    expect(onRename).toHaveBeenCalledWith("col-backlog", "Backlog!");
  });

  it("calls onDeleteCard with the column and card id when a card is deleted", async () => {
    const onDeleteCard = vi.fn();
    renderColumn({ onDeleteCard });

    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /delete first card/i }));

    expect(onDeleteCard).toHaveBeenCalledWith("col-backlog", "card-1");
  });
});
