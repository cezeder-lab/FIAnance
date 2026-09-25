import type { Tone } from './StatusBadge';

const FILL: Record<Tone, string> = {
  good: 'bg-good',
  warning: 'bg-warning',
  critical: 'bg-critical',
  neutral: 'bg-[var(--baseline)]',
  accent: 'bg-accent',
};

export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: Tone; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${FILL[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
