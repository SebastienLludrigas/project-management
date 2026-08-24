import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/board")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => initialData,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });
  });

  it("renders login form when unauthenticated", () => {
    render(<KanbanBoard />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  describe("when authenticated", () => {
    beforeEach(() => {
      localStorage.setItem("kanban_token", "test-token");
      localStorage.setItem("kanban_user", "test-user");
    });

    it("renders five columns and signed in user", async () => {
      render(<KanbanBoard />);
      await waitFor(() => {
        expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
      });
      expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
      expect(screen.getByText("test-user")).toBeInTheDocument();
    });

    it("signs out the user when sign out button is clicked", async () => {
      render(<KanbanBoard />);
      await waitFor(() => {
        expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
      });
      const signOutButton = screen.getByRole("button", { name: /sign out/i });
      await userEvent.click(signOutButton);

      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
      expect(localStorage.getItem("kanban_token")).toBeNull();
    });

    it("renames a column", async () => {
      render(<KanbanBoard />);
      await waitFor(() => {
        expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
      });
      const column = getFirstColumn();
      const input = within(column).getByLabelText("Column title");
      await userEvent.clear(input);
      await userEvent.type(input, "New Name");
      expect(input).toHaveValue("New Name");
    });

    it("adds and removes a card", async () => {
      render(<KanbanBoard />);
      await waitFor(() => {
        expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
      });
      const column = getFirstColumn();
      const addButton = within(column).getByRole("button", {
        name: /add a card/i,
      });
      await userEvent.click(addButton);

      const titleInput = within(column).getByPlaceholderText(/card title/i);
      await userEvent.type(titleInput, "New card");
      const detailsInput = within(column).getByPlaceholderText(/details/i);
      await userEvent.type(detailsInput, "Notes");

      await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

      expect(within(column).getByText("New card")).toBeInTheDocument();

      const deleteButton = within(column).getByRole("button", {
        name: /delete new card/i,
      });
      await userEvent.click(deleteButton);

      expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    });
  });
});
