"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardData } from "@/lib/kanban";
import { sendAIChatMessage, type ChatMessageItem } from "@/lib/api";

type KanbanChatSidebarProps = {
  board: BoardData;
  onBoardUpdate: (updatedBoard: BoardData) => void;
  isOpen: boolean;
  onClose: () => void;
};

// Mirrors the backend's history window (backend/ai.py) to avoid sending a payload the API discards
const MAX_HISTORY_MESSAGES = 20;

const SUGGESTIONS = [
  "Ajoute une carte 'Tests QA' dans Review",
  "Crée une tâche 'Optimiser la BDD' dans In Progress",
  "Fais-moi un résumé du projet",
];

const cleanContent = (raw: string): string => {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"message"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      const match = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1];
        }
      }
    }
  }
  return raw;
};

const renderInline = (text: string, isUser: boolean) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={index}
          className={isUser ? "font-semibold text-white" : "font-semibold text-[var(--navy-dark)]"}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className={`rounded px-1.5 py-0.5 font-mono text-xs ${
            isUser ? "bg-white/20 text-white" : "bg-slate-100 text-[var(--navy-dark)]"
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const FormattedMessage = ({ content, isUser }: { content: string; isUser: boolean }) => {
  const text = cleanContent(content);
  const blocks = text.split(/\n\s*\n/);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, bIdx) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        const isBulletList = lines.every((line) => /^[-*•]\s+/.test(line));
        if (isBulletList && lines.length > 0) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-1 pl-0.5">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="flex items-start gap-2">
                  <span
                    className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                      isUser ? "bg-white" : "bg-[var(--primary-blue)]"
                    }`}
                  />
                  <span className="flex-1">
                    {renderInline(line.replace(/^[-*•]\s+/, ""), isUser)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));
        if (isNumberedList && lines.length > 0) {
          return (
            <ol key={bIdx} className="space-y-1.5 my-1 pl-0.5">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="flex items-start gap-2">
                  <span
                    className={`font-semibold text-xs mt-0.5 shrink-0 ${
                      isUser ? "text-white/80" : "text-[var(--primary-blue)]"
                    }`}
                  >
                    {lIdx + 1}.
                  </span>
                  <span className="flex-1">
                    {renderInline(line.replace(/^\d+\.\s+/, ""), isUser)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <div key={bIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (line.startsWith("### ")) {
                return (
                  <h4
                    key={lIdx}
                    className={`font-bold text-xs uppercase tracking-wider mt-2 mb-1 ${
                      isUser ? "text-white" : "text-[var(--navy-dark)]"
                    }`}
                  >
                    {renderInline(line.replace(/^###\s+/, ""), isUser)}
                  </h4>
                );
              }
              return (
                <p key={lIdx} className="leading-relaxed">
                  {renderInline(line, isUser)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const KanbanChatSidebar = ({
  board,
  onBoardUpdate,
  isOpen,
  onClose,
}: KanbanChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis votre assistant IA. Vous pouvez me demander de créer, déplacer ou éditer des cartes, ou me poser des questions sur votre projet.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessageItem = { role: "user", content };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    const startTime = performance.now();
    console.log(
      `%c[AI Chat] Envoi du message : "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
      "color: #753991; font-weight: 600;"
    );

    try {
      const response = await sendAIChatMessage(
        updatedMessages.slice(-MAX_HISTORY_MESSAGES),
        board
      );
      const durationMs = performance.now() - startTime;
      const durationSec = (durationMs / 1000).toFixed(2);

      console.log(
        `%c[AI Chat] Réponse reçue en ${durationSec}s (${Math.round(durationMs)}ms)`,
        "color: #209dd7; font-weight: bold;"
      );

      const assistantMessage: ChatMessageItem = {
        role: "assistant",
        content: response.message,
      };
      setMessages([...updatedMessages, assistantMessage]);

      if (response.board) {
        onBoardUpdate(response.board);
      }
    } catch (err) {
      const durationMs = performance.now() - startTime;
      const durationSec = (durationMs / 1000).toFixed(2);
      console.error(
        `%c[AI Chat] Erreur après ${durationSec}s (${Math.round(durationMs)}ms):`,
        "color: #e11d48; font-weight: bold;",
        err
      );
      setError(
        err instanceof Error ? err.message : "Une erreur est survenue avec l'IA."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[420px] flex-col border-l border-[var(--stroke)] bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:w-[420px]"
      data-testid="ai-chat-sidebar"
      aria-label="Assistant IA"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-yellow)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent-yellow)]"></span>
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-[var(--navy-dark)]">
              AI Board Assistant
            </h2>
            <p className="text-[11px] font-medium text-[var(--primary-blue)]">
              deepseek-v4-flash
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le chat"
          className="rounded-full border border-[var(--stroke)] p-2 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
        >
          ✕
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="border-b border-[var(--stroke)] bg-[var(--surface)] px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--gray-text)]">
          Suggestions rapides
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(suggestion)}
              className="rounded-full border border-[var(--stroke)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <span className="mb-1 text-[10px] font-semibold text-[var(--gray-text)] uppercase tracking-wider">
                {isUser ? "Vous" : "Assistant"}
              </span>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-[var(--secondary-purple)] text-white shadow-sm"
                    : "border border-[var(--stroke)] bg-white text-[var(--navy-dark)] shadow-[var(--shadow)]"
                }`}
              >
                <FormattedMessage content={msg.content} isUser={isUser} />
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start">
            <span className="mb-1 text-[10px] font-semibold text-[var(--primary-blue)] uppercase tracking-wider">
              Assistant
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs text-[var(--gray-text)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)] animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-[var(--primary-blue)] animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-[var(--secondary-purple)] animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1">L&apos;IA réfléchit et met à jour le tableau...</span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-[var(--stroke)] bg-white p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Demander à l'IA d'ajouter ou déplacer une carte..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-40"
          >
            Envoyer
          </button>
        </form>
      </div>
    </aside>
  );
};
