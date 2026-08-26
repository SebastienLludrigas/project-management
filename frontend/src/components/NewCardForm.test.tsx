import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewCardForm } from "@/components/NewCardForm";

describe("NewCardForm", () => {
  it("opens the form when 'Add a card' is clicked", async () => {
    render(<NewCardForm onAdd={vi.fn()} />);

    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));

    expect(screen.getByPlaceholderText(/card title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/details/i)).toBeInTheDocument();
  });

  it("does not call onAdd when the title is blank", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: /^add card$/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("calls onAdd with trimmed values and resets the form", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "  New task  ");
    await userEvent.type(screen.getByPlaceholderText(/details/i), "  Some details  ");
    await userEvent.click(screen.getByRole("button", { name: /^add card$/i }));

    expect(onAdd).toHaveBeenCalledWith("New task", "Some details");
    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    expect(screen.getByPlaceholderText(/card title/i)).toHaveValue("");
  });

  it("cancels and resets the form without calling onAdd", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "Draft");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
  });
});
