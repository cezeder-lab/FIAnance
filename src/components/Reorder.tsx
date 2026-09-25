import { useState, type ButtonHTMLAttributes, type DragEvent, type KeyboardEvent } from 'react';
import { GripVertical } from 'lucide-react';
import type { DropPosition } from '../lib/reorder';

// A private type keeps a dropped row from being inserted as text into an input.
const MIME = 'application/x-fianance-row';

/**
 * Drag-and-drop reordering inside one list. Spread `itemProps(id)` on each row (a `.reorder-item` element)
 * and `handleProps(id, label)` on its handle; the handle also moves the row with the up/down arrow keys.
 */
export function useReorder(ids: string[], onMove: (fromId: string, toId: string, position: DropPosition) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; position: DropPosition } | null>(null);

  const reset = () => {
    setDragId(null);
    setTarget(null);
  };

  const itemProps = (id: string) => ({
    'data-reorder-item': '',
    'data-drop': target?.id === id ? target.position : undefined,
    'data-dragging': dragId === id ? '' : undefined,
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId || dragId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const position: DropPosition = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      if (target?.id !== id || target.position !== position) setTarget({ id, position });
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return;
      e.preventDefault();
      if (target) onMove(dragId, target.id, target.position);
      reset();
    },
  });

  const handleProps = (id: string, label: string): ButtonHTMLAttributes<HTMLButtonElement> => ({
    draggable: true,
    'aria-label': `Déplacer ${label || 'la ligne'}`,
    title: 'Glisser pour changer l’ordre (ou flèches haut / bas)',
    onDragStart: (e: DragEvent<HTMLButtonElement>) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(MIME, id);
      const row = e.currentTarget.closest('[data-reorder-item]');
      if (row instanceof HTMLElement) e.dataTransfer.setDragImage(row, 12, 12);
    },
    onDragEnd: reset,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      const i = ids.indexOf(id);
      if (e.key === 'ArrowUp' && i > 0) {
        e.preventDefault();
        onMove(id, ids[i - 1], 'before');
      } else if (e.key === 'ArrowDown' && i >= 0 && i < ids.length - 1) {
        e.preventDefault();
        onMove(id, ids[i + 1], 'after');
      }
    },
  });

  return { itemProps, handleProps };
}

export function DragHandle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted opacity-60 hover:bg-sunken hover:text-ink hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
      {...props}
    >
      <GripVertical size={14} />
    </button>
  );
}
