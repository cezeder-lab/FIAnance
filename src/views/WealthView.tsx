import { useState, type ReactNode } from 'react';
import { Camera, Plus } from 'lucide-react';
import type { AssetKind, AssetLine, PatrimoineFile } from '../types';
import { useData } from '../state/DataContext';
import { availableWealth, sumLines } from '../lib/calc';
import { formatEURRounded, formatSignedEUR } from '../lib/format';
import { formatDay, formatMonthLong, formatMonthShort, isMonthKey } from '../lib/months';
import { uid } from '../lib/seed';
import { ASSET_KIND_LABELS } from '../lib/labels';
import { AmountInput } from '../components/AmountInput';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Card, PageHeader } from '../components/Layout';
import { TrendChart } from '../components/TrendChart';

type Section = 'financier' | 'immobilier' | 'heritage';

export function WealthView() {
  const { patrimoine, nowKey, updatePatrimoine } = useData();
  const [focusId, setFocusId] = useState<string | null>(null);

  const total = availableWealth(patrimoine);
  const byKind = (k: AssetKind) => sumLines(patrimoine.financier.filter((l) => (l.kind ?? 'liquide') === k));
  const history = [...patrimoine.history].sort((a, b) => a.month.localeCompare(b.month));
  const lastPoint = [...history].reverse().find((p) => p.month < nowKey);
  const currentPoint = history.find((p) => p.month === nowKey);

  const setLines = (section: Section, fn: (lines: AssetLine[]) => AssetLine[]) =>
    updatePatrimoine((prev) => ({ ...prev, [section]: fn(prev[section]) }));

  const addLine = (section: Section) => {
    const id = uid();
    setLines(section, (lines) => [
      ...lines,
      { id, label: '', amount: 0, kind: section === 'financier' ? 'liquide' : undefined, updatedAt: null },
    ]);
    setFocusId(id);
  };

  const snapshot = () =>
    updatePatrimoine((prev) => ({
      ...prev,
      history: [...prev.history.filter((p) => p.month !== nowKey), { month: nowKey, total: availableWealth(prev) }],
    }));

  return (
    <div>
      <PageHeader title="Patrimoine" subtitle="Montants mis à jour à la main, sans aucune synchronisation bancaire." />

      <div className="card flex flex-wrap items-end justify-between gap-6 p-6">
        <div>
          <div className="text-sm font-medium text-ink-2">Patrimoine financier net disponible</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight text-ink">{formatEURRounded(total)}</div>
          <div className="tabular mt-2 flex flex-wrap gap-x-4 text-sm text-ink-2">
            {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((k) => (
              <span key={k}>
                {ASSET_KIND_LABELS[k]} <span className="font-medium text-ink">{formatEURRounded(byKind(k))}</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Liquide + investi. Hors immobilier/familial et hors héritage non reçu.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button type="button" className="btn-primary" onClick={snapshot}>
            <Camera size={16} /> {currentPoint ? 'Mettre à jour' : 'Enregistrer'} le point de {formatMonthLong(nowKey).toLowerCase()}
          </button>
          {lastPoint && (
            <span className="text-xs text-muted">
              {formatSignedEUR(total - lastPoint.total)} depuis {formatMonthLong(lastPoint.month).toLowerCase()}
            </span>
          )}
        </div>
      </div>

      <AssetCard
        className="mt-6"
        title="Financier — liquide & investi"
        subtitle="Compte dans le total disponible."
        lines={patrimoine.financier}
        withKind
        focusId={focusId}
        onChange={(fn) => setLines('financier', fn)}
        onAdd={() => addLine('financier')}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AssetCard
          title="Immobilier & familial"
          subtitle="Affiché à part, jamais additionné au disponible."
          lines={patrimoine.immobilier}
          focusId={focusId}
          onChange={(fn) => setLines('immobilier', fn)}
          onAdd={() => addLine('immobilier')}
          empty="Rien de renseigné."
        />
        <AssetCard
          className="border-dashed"
          title={
            <span className="flex items-center gap-2">
              Héritage potentiel
              <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-medium text-ink">Non reçu · non certain</span>
            </span>
          }
          subtitle="Jamais compté dans le patrimoine disponible."
          lines={patrimoine.heritage}
          focusId={focusId}
          onChange={(fn) => setLines('heritage', fn)}
          onAdd={() => addLine('heritage')}
          empty="Rien de renseigné."
          muted
        />
      </div>

      <HistoryCard patrimoine={patrimoine} history={history} onChange={updatePatrimoine} />
    </div>
  );
}

function AssetCard({
  title,
  subtitle,
  lines,
  withKind = false,
  focusId,
  onChange,
  onAdd,
  empty,
  muted = false,
  className = '',
}: {
  title: ReactNode;
  subtitle: string;
  lines: AssetLine[];
  withKind?: boolean;
  focusId: string | null;
  onChange: (fn: (lines: AssetLine[]) => AssetLine[]) => void;
  onAdd: () => void;
  empty?: string;
  muted?: boolean;
  className?: string;
}) {
  const patch = (id: string, p: Partial<AssetLine>) => onChange((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  return (
    <Card
      className={className}
      title={title}
      subtitle={subtitle}
      actions={<span className={`tabular text-[15px] font-semibold ${muted ? 'text-ink-2' : 'text-ink'}`}>{formatEURRounded(sumLines(lines))}</span>}
      bodyClassName="px-3 py-2"
    >
      {lines.length === 0 && empty && <p className="px-2 py-3 text-sm text-muted">{empty}</p>}
      <ul>
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-2 border-b border-line py-1 last:border-0">
            <input
              className="inline-input min-w-0 flex-1"
              value={l.label}
              title={l.label}
              placeholder="Nouvelle ligne"
              aria-label="Libellé"
              autoFocus={l.id === focusId}
              onChange={(e) => patch(l.id, { label: e.target.value })}
            />
            {withKind && (
              <select
                className="inline-input w-24 shrink-0 text-xs text-ink-2"
                value={l.kind ?? 'liquide'}
                aria-label="Type"
                onChange={(e) => patch(l.id, { kind: e.target.value as AssetKind })}
              >
                {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((k) => (
                  <option key={k} value={k}>
                    {ASSET_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            )}
            <span className="hidden w-28 shrink-0 text-right text-xs text-muted md:block">
              {l.updatedAt ? `maj ${formatDay(l.updatedAt)}` : ''}
            </span>
            <AmountInput
              className="w-36 shrink-0"
              value={l.amount}
              ariaLabel={`Montant ${l.label}`}
              onChange={(v) => patch(l.id, { amount: v ?? 0, updatedAt: new Date().toISOString() })}
            />
            <ConfirmDelete onConfirm={() => onChange((ls) => ls.filter((x) => x.id !== l.id))} />
          </li>
        ))}
      </ul>
      <button type="button" className="btn-ghost mt-1 text-accent hover:text-accent" onClick={onAdd}>
        <Plus size={16} /> Ajouter
      </button>
    </Card>
  );
}

function HistoryCard({
  patrimoine,
  history,
  onChange,
}: {
  patrimoine: PatrimoineFile;
  history: PatrimoineFile['history'];
  onChange: (fn: (p: PatrimoineFile) => PatrimoineFile) => void;
}) {
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const canAdd = isMonthKey(month) && amount !== null;

  const add = () => {
    if (!canAdd) return;
    onChange((p) => ({ ...p, history: [...p.history.filter((h) => h.month !== month), { month, total: amount }] }));
    setMonth('');
    setAmount(null);
  };

  return (
    <Card
      className="mt-6"
      title="Évolution du patrimoine financier disponible"
      subtitle="Un point par mois, enregistré avec le bouton ci-dessus ou saisi à la main."
    >
      <TrendChart
        data={history.map((h) => ({ key: h.month, label: formatMonthShort(h.month), value: h.total }))}
        seriesName="Patrimoine disponible"
        emptyText="Enregistrez au moins deux points mensuels pour voir la courbe."
      />
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="section-title mb-2">Points enregistrés ({patrimoine.history.length})</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Aucun point pour l’instant.</p>
          ) : (
            <ul className="tabular max-h-56 overflow-y-auto text-sm">
              {[...history].reverse().map((h) => (
                <li key={h.month} className="flex items-center gap-2 border-b border-line py-1 last:border-0">
                  <span className="flex-1 text-ink">{formatMonthLong(h.month)}</span>
                  <AmountInput
                    className="w-36"
                    value={h.total}
                    ariaLabel={`Total ${h.month}`}
                    onChange={(v) =>
                      onChange((p) => ({ ...p, history: p.history.map((x) => (x.month === h.month ? { ...x, total: v ?? 0 } : x)) }))
                    }
                  />
                  <ConfirmDelete onConfirm={() => onChange((p) => ({ ...p, history: p.history.filter((x) => x.month !== h.month) }))} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="section-title mb-2">Ajouter un point passé</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="w-44">
              <span className="label">Mois</span>
              <input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <label className="w-40">
              <span className="label">Montant</span>
              <AmountInput variant="field" allowEmpty value={amount} onChange={setAmount} />
            </label>
            <button type="button" className="btn-secondary" disabled={!canAdd} onClick={add}>
              <Plus size={16} /> Ajouter
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
