import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

/** Two clicks: the trash icon arms the button, the second click deletes. */
export function ConfirmDelete({ onConfirm, label = 'Supprimer' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <button
        type="button"
        autoFocus
        className="whitespace-nowrap rounded-md bg-critical px-2 py-1 text-xs font-medium text-white hover:opacity-90"
        onClick={onConfirm}
        onBlur={() => setArmed(false)}
      >
        Confirmer
      </button>
    );
  }
  return (
    <button type="button" className="icon-btn hover:text-[var(--critical-ink)]" title={label} aria-label={label} onClick={() => setArmed(true)}>
      <Trash2 size={15} />
    </button>
  );
}
