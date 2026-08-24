"use client";

import { useState } from "react";

type LoginFormProps = {
  onLoginSuccess: (token: string, username: string) => void;
};

export const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid username or password");
      }

      const data = await response.json();
      localStorage.setItem("kanban_token", data.access_token);
      localStorage.setItem("kanban_user", data.username);
      onLoginSuccess(data.access_token, data.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient background accents matching design system */}
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <div className="relative w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-8 rounded-full bg-[var(--accent-yellow)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Kanban Studio MVP
          </p>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold text-[var(--navy-dark)]">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-[var(--gray-text)]">
          Sign in to access and manage your project board.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--navy-dark)]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. user"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--navy-dark)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
            />
          </div>

          <div className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-3 text-xs text-[var(--gray-text)]">
            <span className="font-semibold text-[var(--primary-blue)]">Demo Credentials:</span>{" "}
            Username: <code className="font-semibold text-[var(--navy-dark)]">user</code> | Password:{" "}
            <code className="font-semibold text-[var(--navy-dark)]">password</code>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign in to Board"}
          </button>
        </form>
      </div>
    </div>
  );
};
