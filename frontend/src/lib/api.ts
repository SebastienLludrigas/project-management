import type { BoardData } from "@/lib/kanban";

export type ChatMessageItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIChatResponseData = {
  message: string;
  board: BoardData | null;
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("kanban_token");
};

export const fetchBoard = async (): Promise<BoardData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch("/api/board", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("kanban_token");
      localStorage.removeItem("kanban_user");
    }
    throw new Error(`Failed to fetch board: ${response.statusText}`);
  }

  return response.json();
};

export const saveBoard = async (board: BoardData): Promise<BoardData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch("/api/board", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("kanban_token");
      localStorage.removeItem("kanban_user");
    }
    throw new Error(`Failed to save board: ${response.statusText}`);
  }

  return response.json();
};

export const sendAIChatMessage = async (
  messages: ChatMessageItem[],
  board?: BoardData
): Promise<AIChatResponseData> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      board: board || null,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("kanban_token");
      localStorage.removeItem("kanban_user");
    }
    let errorDetail = response.statusText;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail =
          typeof errData.detail === "string"
            ? errData.detail
            : JSON.stringify(errData.detail);
      }
    } catch {
      // Fallback to status text
    }
    throw new Error(errorDetail || "Une erreur est survenue avec l'IA.");
  }

  return response.json();
};
