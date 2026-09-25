import type { ReactNode } from 'react';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import type { Nav } from '../App';
import { useData } from '../state/DataContext';
import { availableWealth, contributionStart, goalProgress, monthTotals } from '../lib/calc';
import { accountSummary } from '../lib/account';
import { formatEURRounded, formatPercent, formatSignedEUR } from '../lib/format';
import { addMonths, formatMonthLong, formatMonthShort, monthsLeftLabel } from '../lib/months';
import { Card, PageHeader, StatTile } from '../components/Layout';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge, statusTone } from '../components/StatusBadge';
import { TrendChart } from '../components/TrendChart';

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
      {children} <ArrowRight size={14} />
    </button>
  );
}

export function Dashboard({ nav }: { nav: Nav }) {
  const { months, goals, patrimoine, nowKey } = useData();
  const items = months.months[nowKey]?.items ?? [];
  const t = monthTotals(items);

  const wealth = availableWealth(patrimoine);
  const history = [...patrimoine.history].sort((a, b) => a.month.localeCompare(b.month));
  const previous = [...history].reverse().find((p) => p.month < nowKey);

  const prevKey = addMonths(nowKey, -1);
  const prevToClose = months.months[prevKey] && !months.months[prevKey].closure;

  const account = accountSummary(months, nowKey);

  const fromKey = contributionStart(months, nowKey);
  const rank = { haute: 0, basse: 1, abandonne: 2 } as const;
  // Stable sort: within a priority, goals keep the order chosen in the Objectifs view.
  const active = goals.goals
    .filter((g) => g.kind === 'achat' && g.priority !== 'abandonne')
    .map((g) => ({ goal: g, progress: goalProgress(g, fromKey, items) }))
    .sort((a, b) => rank[a.goal.priority] - rank[b.goal.priority]);
  const incomes = goals.goals.filter((g) => g.kind === 'entree' && g.priority !== 'abandonne');

  return (
    <div>
      <PageHeader title="Vue d’ensemble" subtitle={formatMonthLong(nowKey)} />

      {prevToClose && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          <CalendarCheck size={18} className="shrink-0 text-accent" />
          <span className="flex-1">
            {formatMonthLong(prevKey)} n’est pas clôturé : enregistrez le point de patrimoine et versez l’épargne du mois aux objectifs.
          </span>
          <button type="button" className="btn-primary" onClick={() => nav.go('mois', { month: prevKey, close: true })}>
            Clôturer {formatMonthLong(prevKey).toLowerCase()}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatTile
          hero
          label={`Cash-flow net · ${formatMonthLong(nowKey).toLowerCase()}`}
          value={formatEURRounded(t.cashflow)}
          valueClassName={t.cashflow < 0 ? 'text-negative' : 'text-positive'}
        >
          <div className="tabular">
            {formatEURRounded(t.revenus)} de revenus − {formatEURRounded(t.depensesFixes + t.depensesVariables)} de dépenses −{' '}
            {formatEURRounded(t.epargne)} d’épargne
          </div>
          {account.actual && (
            <div className="tabular mt-1.5">
              Compte courant : <span className="font-medium text-ink">{formatEURRounded(account.actual.amount)}</span>
              {account.endOfMonth !== null && <> · fin de mois prévue {formatEURRounded(account.endOfMonth)}</>}
              {account.gap !== null && account.gap <= -1 && (
                <span className="text-negative"> · écart {formatSignedEUR(account.gap)}</span>
              )}
            </div>
          )}
          <div className="mt-2">
            <LinkButton onClick={() => nav.go('mois', { month: nowKey })}>Détail du mois</LinkButton>
          </div>
        </StatTile>

        <StatTile hero label="Patrimoine financier net disponible" value={formatEURRounded(wealth)}>
          <div>
            {previous ? (
              <>
                <span className={`tabular font-medium ${wealth - previous.total < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatSignedEUR(wealth - previous.total)}
                </span>{' '}
                depuis {formatMonthLong(previous.month).toLowerCase()}
              </>
            ) : (
              'Livrets, placements et crypto'
            )}
          </div>
          <div className="mt-2">
            <LinkButton onClick={() => nav.go('patrimoine')}>Détail du patrimoine</LinkButton>
          </div>
        </StatTile>

        <StatTile hero label="Taux d’épargne du mois" value={t.savingsRate !== null ? formatPercent(t.savingsRate) : '—'}>
          <div className="tabular">
            {formatEURRounded(t.epargne)} mis de côté sur {formatEURRounded(t.revenus)} de revenus
          </div>
        </StatTile>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Objectifs actifs" actions={<LinkButton onClick={() => nav.go('objectifs')}>Tous les objectifs</LinkButton>}>
          {active.length === 0 ? (
            <p className="text-sm text-muted">Aucun objectif actif.</p>
          ) : (
            <ul className="space-y-5">
              {active.map(({ goal, progress }) => (
                <li key={goal.id}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{goal.name || 'Sans nom'}</span>
                    <StatusBadge progress={progress} />
                    <span className="tabular ml-auto text-sm text-ink-2">
                      {formatEURRounded(goal.savedAmount)}
                      {goal.targetAmount !== null && <span className="text-muted"> / {formatEURRounded(goal.targetAmount)}</span>}
                    </span>
                  </div>
                  {progress.progress !== null ? (
                    <ProgressBar value={progress.progress} tone={statusTone(progress.status)} label={goal.name} />
                  ) : (
                    <div className="h-2 rounded-full bg-sunken" />
                  )}
                  <div className="tabular mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
                    {goal.targetDate && (
                      <span>
                        {formatMonthShort(goal.targetDate)} · {monthsLeftLabel(nowKey, goal.targetDate)}
                      </span>
                    )}
                    {progress.requiredMonthly !== null && progress.requiredMonthly > 0 && !progress.overdue && (
                      <span>
                        {formatEURRounded(progress.requiredMonthly)}/mois nécessaires · {formatEURRounded(progress.currentMonthly)}/mois actuels
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Entrées d’argent prévues" className="self-start">
          {incomes.length === 0 ? (
            <p className="text-sm text-muted">Aucune.</p>
          ) : (
            <ul className="space-y-3">
              {incomes.map((g) => (
                <li key={g.id}>
                  <div className="font-medium text-ink">{g.name}</div>
                  <div className="tabular text-sm text-ink-2">
                    {g.amountMin !== null && g.amountMax !== null && g.amountMin !== g.amountMax
                      ? `${formatEURRounded(g.amountMin)} – ${formatEURRounded(g.amountMax)}`
                      : formatEURRounded(g.amountMin ?? g.amountMax ?? 0)}
                  </div>
                  {g.targetDate && (
                    <div className="text-xs text-muted">
                      {formatMonthLong(g.targetDate)} · {monthsLeftLabel(nowKey, g.targetDate)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6" title="Évolution du patrimoine financier disponible">
        <TrendChart
          data={history.map((h) => ({ key: h.month, label: formatMonthShort(h.month), value: h.total }))}
          seriesName="Patrimoine disponible"
          height={200}
          emptyText="Clôturez chaque mois (ou enregistrez un point depuis l’onglet Patrimoine) pour suivre l’évolution."
        />
      </Card>
    </div>
  );
}
