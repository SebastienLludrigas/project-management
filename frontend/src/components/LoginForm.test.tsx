import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders login form with demo credentials hint", () => {
    render(<LoginForm onLoginSuccess={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to board/i })).toBeInTheDocument();
    expect(screen.getByText(/demo credentials/i)).toBeInTheDocument();
  });

  it("displays error on invalid credentials", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Invalid username or password" }),
    });

    render(<LoginForm onLoginSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/username/i), "wrong");
    await userEvent.type(screen.getByLabelText(/password/i), "badpass");
    await userEvent.click(screen.getByRole("button", { name: /sign in to board/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid username or password/i);
    });
  });

  it("calls onLoginSuccess and sets localStorage on successful login", async () => {
    const handleSuccess = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "mock-token-123",
        token_type: "bearer",
        username: "user",
      }),
    });

    render(<LoginForm onLoginSuccess={handleSuccess} />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in to board/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith("mock-token-123", "user");
      expect(localStorage.getItem("kanban_token")).toBe("mock-token-123");
      expect(localStorage.getItem("kanban_user")).toBe("user");
    });
  });
});
