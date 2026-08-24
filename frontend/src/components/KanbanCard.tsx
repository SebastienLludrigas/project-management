import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold text-[var(--navy-dark)] break-words leading-snug">
            {card.title}
          </h4>
          {card.details ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)] break-words line-clamp-4">
              {card.details}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-400"
          aria-label={`Delete ${card.title}`}
          title="Supprimer la carte"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </article>
  );
};
