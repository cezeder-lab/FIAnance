import { ArrowDownLeft, Ban, CircleAlert, CircleCheck, CircleDashed, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { GoalProgress, GoalStatus } from '../lib/calc';

export type Tone = 'good' | 'warning' | 'critical' | 'neutral' | 'accent';

const META: Record<GoalStatus, { label: string; tone: Tone; Icon: LucideIcon }> = {
  good: { label: 'Dans les temps', tone: 'good', Icon: CircleCheck },
  reached: { label: 'Atteint', tone: 'good', Icon: CircleCheck },
  warning: { label: 'Rythme un peu juste', tone: 'warning', Icon: TriangleAlert },
  critical: { label: 'Rythme insuffisant', tone: 'critical', Icon: CircleAlert },
  nodate: { label: 'Sans échéance', tone: 'neutral', Icon: CircleDashed },
  noamount: { label: 'Montant à définir', tone: 'neutral', Icon: CircleDashed },
  abandoned: { label: 'Abandonné', tone: 'neutral', Icon: Ban },
  income: { label: 'Entrée prévue', tone: 'accent', Icon: ArrowDownLeft },
};

const TONE_CLASS: Record<Tone, { bg: string; icon: string }> = {
  good: { bg: 'bg-[var(--good-soft)]', icon: 'text-[var(--good-ink)]' },
  warning: { bg: 'bg-[var(--warning-soft)]', icon: 'text-[var(--warning-ink)]' },
  critical: { bg: 'bg-[var(--critical-soft)]', icon: 'text-[var(--critical-ink)]' },
  neutral: { bg: 'bg-sunken', icon: 'text-muted' },
  accent: { bg: 'bg-accent-soft', icon: 'text-accent' },
};

export function statusTone(status: GoalStatus): Tone {
  return META[status].tone;
}

export function StatusBadge({ progress, title }: { progress: GoalProgress; title?: string }) {
  const meta = META[progress.status];
  const label = progress.status === 'critical' && progress.overdue ? 'Échéance dépassée' : meta.label;
  const tone = TONE_CLASS[meta.tone];
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-ink ${tone.bg}`}
    >
      <meta.Icon size={13} strokeWidth={2.25} className={tone.icon} aria-hidden />
      {label}
    </span>
  );
}
