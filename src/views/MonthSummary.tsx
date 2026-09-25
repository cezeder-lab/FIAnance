import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useData } from '../state/DataContext';
import type { MonthTotals } from '../lib/calc';
import { accountSummary } from '../lib/account';
import { formatEURRounded, formatPercent, formatSignedEUR } from '../lib/format';
import { formatMonthLong } from '../lib/months';
import { AmountInput } from '../components/AmountInput';

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Below this, a gap is rounding noise. */
const GAP_TOLERANCE = 1;

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{children}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Term({ label, value, op }: { label: string; value: ReactNode; op?: string }) {
  return (
    <>
      {op && <span className="text-muted">{op}</span>}
      <span className="whitespace-nowrap">
        <span className="text-muted">{label} </span>
        <span className="font-medium text-ink">{value}</span>
      </span>
    </>
  );
}

/**
 * One band at the top of the month: the budget's cash-flow next to what the bank says.
 * The detail of both calculations folds away.
 */
export function MonthSummary({
  month,
  totals,
  withAccount,
  readOnly,
  onAddUnidentified,
}: {
  month: string;
  totals: MonthTotals;
  /** Past and current months only: the bank balance means nothing for a future month. */
  withAccount: boolean;
  readOnly: boolean;
  onAddUnidentified: (amount: number) => void;
}) {
  const { months, updateMonths, recordBalance } = useData();
  const s = accountSummary(months, month);
  const [expanded, setExpanded] = useState(withAccount && s.opening === null);

  const setOpening = (value: number | null) =>
    updateMonths((prev) => ({
      ...prev,
      months: { ...prev.months, [month]: { ...prev.months[month], openingBalance: value } },
    }));

  const pending = [
    { label: 'à payer', value: s.toPay },
    { label: 'à verser', value: s.toTransfer },
    { label: 'à recevoir', value: s.toReceive },
  ].filter((p) => p.value > 0);

  return (
    <section className="card p-5" aria-label="Résumé du mois">
      <div className={`grid grid-cols-1 gap-x-8 gap-y-5 ${withAccount ? 'sm:grid-cols-2 xl:grid-cols-4' : ''}`}>
        <Stat
          label="Cash-flow net"
          sub={totals.savingsRate !== null ? `taux d’épargne ${formatPercent(totals.savingsRate)}` : 'après dépenses et épargne'}
        >
          <span className={totals.cashflow < 0 ? 'text-negative' : 'text-positive'}>{formatEURRounded(totals.cashflow)}</span>
        </Stat>

        {withAccount && (
          <>
            <div className="min-w-0 xl:border-l xl:border-line xl:pl-8">
              <div className="text-xs font-medium text-ink-2">Compte courant</div>
              {/* Sized to its content so the figure lines up with the other ones. */}
              <AmountInput
                className="-ml-2 mt-0.5 inline-block"
                inputClassName="w-auto min-w-[5ch] text-xl font-semibold [field-sizing:content]"
                allowEmpty
                placeholder="solde réel"
                value={s.actual?.amount ?? null}
                ariaLabel="Solde réel"
                disabled={readOnly}
                onChange={(v) => recordBalance(month, v)}
              />
              <div className="mt-0.5 text-xs text-muted">
                {s.actual ? `saisi le ${dateTimeFmt.format(new Date(s.actual.at))}` : 'le solde affiché par votre banque'}
              </div>
            </div>

            <Stat
              label="Fin de mois prévue"
              sub={pending.length === 0 ? 'tout est réglé' : `encore ${pending.map((p) => `${formatEURRounded(p.value)} ${p.label}`).join(', ')}`}
            >
              {s.endOfMonth !== null ? formatEURRounded(s.endOfMonth) : <span className="text-muted">—</span>}
            </Stat>

            <Stat
              label="Écart avec le relevé"
              sub={
                s.expected === null ? (
                  <button type="button" className="text-accent hover:underline" onClick={() => setExpanded(true)}>
                    indiquez le solde de départ
                  </button>
                ) : s.gap === null ? (
                  'saisissez le solde réel'
                ) : Math.abs(s.gap) < GAP_TOLERANCE ? (
                  'le relevé correspond aux lignes cochées'
                ) : s.gap < 0 ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    dépenses oubliées ?
                    {!readOnly && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
                        onClick={() => onAddUnidentified(-(s.gap as number))}
                      >
                        <Plus size={12} /> ajouter en dépense
                      </button>
                    )}
                  </span>
                ) : (
                  'une dépense cochée pas encore débitée ?'
                )
              }
            >
              {s.gap === null ? (
                <span className="text-muted">—</span>
              ) : Math.abs(s.gap) < GAP_TOLERANCE ? (
                <span className="text-positive">0 €</span>
              ) : (
                <span className={s.gap < 0 ? 'text-negative' : 'text-ink'}>{formatSignedEUR(s.gap)}</span>
              )}
            </Stat>
          </>
        )}
      </div>

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Détail du calcul
      </button>

      {expanded && (
        <div className="tabular mt-3 space-y-3 rounded-lg bg-sunken px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Term label="Revenus" value={formatEURRounded(totals.revenus)} />
            <Term op="−" label="dépenses fixes" value={formatEURRounded(totals.depensesFixes)} />
            <Term op="−" label="dépenses variables" value={formatEURRounded(totals.depensesVariables)} />
            <Term op="−" label="épargne" value={formatEURRounded(totals.epargne)} />
            <Term op="=" label="cash-flow net" value={formatEURRounded(totals.cashflow)} />
          </div>
          {withAccount && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted">Solde de départ</span>
              <AmountInput
                className="w-32"
                variant="field"
                inputClassName="py-1"
                allowEmpty
                placeholder="à saisir"
                value={s.opening}
                ariaLabel="Solde de départ"
                disabled={readOnly}
                onChange={setOpening}
              />
              <Term op="+" label="reçu" value={formatEURRounded(s.received)} />
              <Term op="−" label="payé" value={formatEURRounded(s.paid)} />
              <Term op="−" label="versé" value={formatEURRounded(s.transferred)} />
              <Term op="=" label="solde attendu" value={s.expected !== null ? formatEURRounded(s.expected) : '—'} />
              <span className="w-full text-xs text-muted">
                Solde de départ : le solde avant le salaire.{' '}
                {s.inheritedFrom
                  ? `Repris du dernier solde relevé en ${formatMonthLong(s.inheritedFrom).toLowerCase()}.`
                  : 'Il sera repris automatiquement du solde saisi à la clôture du mois précédent.'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
