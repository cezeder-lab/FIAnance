import type { ReactNode } from 'react';
import { CircleCheck, Plus, TriangleAlert } from 'lucide-react';
import { useData } from '../state/DataContext';
import { accountSummary } from '../lib/account';
import { formatEURRounded, formatSignedEUR } from '../lib/format';
import { formatMonthLong } from '../lib/months';
import { AmountInput } from '../components/AmountInput';
import { Card } from '../components/Layout';

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Below this, a gap is rounding noise. */
const GAP_TOLERANCE = 1;

function Cell({ label, children, hint, strong = false }: { label: string; children: ReactNode; hint?: ReactNode; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular mt-0.5 ${strong ? 'text-lg font-semibold text-ink' : 'font-semibold text-ink'}`}>{children}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

const Op = ({ children }: { children: string }) => <span className="pb-1 text-lg text-muted">{children}</span>;

export function AccountCard({
  month,
  readOnly,
  onAddUnidentified,
}: {
  month: string;
  readOnly: boolean;
  onAddUnidentified: (amount: number) => void;
}) {
  const { months, updateMonths, recordBalance } = useData();
  const s = accountSummary(months, month);
  const explicitOpening = months.months[month]?.openingBalance ?? null;

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
    <Card
      className="mt-6"
      title="Compte courant"
      subtitle="Le solde réel de votre banque, comparé à ce que prévoient les lignes cochées ci-dessous."
      bodyClassName="p-5"
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
        <div>
          <div className="text-xs text-muted">Solde de départ (avant le salaire)</div>
          <AmountInput
            className="mt-0.5 w-36"
            variant="field"
            allowEmpty
            placeholder="à saisir"
            value={s.opening}
            ariaLabel="Solde de départ"
            disabled={readOnly}
            onChange={setOpening}
          />
          <div className="mt-0.5 h-4 text-[11px] text-muted">
            {s.inheritedFrom
              ? `repris du solde relevé en ${formatMonthLong(s.inheritedFrom).toLowerCase()}`
              : explicitOpening !== null
                ? 'saisi à la main'
                : ''}
          </div>
        </div>
        <Op>+</Op>
        <Cell label="Reçu">{formatEURRounded(s.received)}</Cell>
        <Op>−</Op>
        <Cell label="Payé">{formatEURRounded(s.paid)}</Cell>
        <Op>−</Op>
        <Cell label="Versé (épargne)">{formatEURRounded(s.transferred)}</Cell>
        <Op>=</Op>
        <Cell label="Solde attendu" strong>
          {s.expected !== null ? formatEURRounded(s.expected) : '—'}
        </Cell>

        <div className="ml-auto border-l border-line pl-6">
          <div className="text-xs text-muted">Solde réel sur votre compte</div>
          <AmountInput
            className="mt-0.5 w-40"
            variant="field"
            allowEmpty
            placeholder="à saisir"
            value={s.actual?.amount ?? null}
            ariaLabel="Solde réel"
            disabled={readOnly}
            onChange={(v) => recordBalance(month, v)}
          />
          <div className="mt-0.5 h-4 text-[11px] text-muted">{s.actual ? `saisi le ${dateTimeFmt.format(new Date(s.actual.at))}` : ''}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        {s.expected === null ? (
          <p className="text-muted">Indiquez le solde de départ pour calculer le solde attendu.</p>
        ) : s.gap === null ? (
          <p className="text-muted">Saisissez le solde réel de votre compte pour vérifier qu’aucune dépense n’a été oubliée.</p>
        ) : Math.abs(s.gap) < GAP_TOLERANCE ? (
          <p className="flex items-center gap-2 text-ink">
            <CircleCheck size={16} className="text-[var(--good-ink)]" /> Le solde réel correspond au solde attendu.
          </p>
        ) : s.gap < 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <TriangleAlert size={16} className="shrink-0 text-[var(--warning-ink)]" />
            <span className="text-ink">
              Écart de <span className="tabular font-semibold text-negative">{formatSignedEUR(s.gap)}</span> : il manque
              probablement des dépenses non saisies ou non cochées.
            </span>
            {!readOnly && (
              <button type="button" className="btn-secondary py-1" onClick={() => onAddUnidentified(-(s.gap as number))}>
                <Plus size={15} /> Ajouter l’écart en dépense variable
              </button>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-ink">
            <TriangleAlert size={16} className="shrink-0 text-[var(--warning-ink)]" />
            <span>
              Écart de <span className="tabular font-semibold text-positive">{formatSignedEUR(s.gap)}</span> : une dépense cochée n’est
              peut-être pas encore débitée, ou une rentrée n’est pas saisie.
            </span>
          </p>
        )}

        <p className="tabular text-ink-2">
          {pending.length === 0 ? 'Tout est réglé pour ce mois.' : `Encore ${pending.map((p) => `${formatEURRounded(p.value)} ${p.label}`).join(', ')}.`}
          {s.endOfMonth !== null && (
            <>
              {' '}
              Solde de fin de mois prévu : <span className="font-semibold text-ink">{formatEURRounded(s.endOfMonth)}</span>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
