import { useState, type ReactNode } from 'react';
import { Camera, LoaderCircle, Plus, RefreshCw, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import type { AssetKind, AssetLine, PatrimoineFile } from '../types';
import { useData } from '../state/DataContext';
import { availableWealth, sumLines, valued, withHistoryPoint } from '../lib/calc';
import { bridge } from '../lib/bridge';
import { formatEUR, formatEURRounded, formatSignedEUR } from '../lib/format';
import { formatDay, formatMonthLong, formatMonthShort, isMonthKey } from '../lib/months';
import { uid } from '../lib/seed';
import { ASSET_KIND_LABELS } from '../lib/labels';
import { AmountInput } from '../components/AmountInput';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Card, PageHeader } from '../components/Layout';
import { TrendChart } from '../components/TrendChart';

type Section = 'financier' | 'immobilier' | 'heritage';

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Applies an edit; touching a value (amount, quantity, price) counts as an update of the line. */
function patched(line: AssetLine, p: Partial<AssetLine>): AssetLine {
  const next = valued({ ...line, ...p });
  const touchesValue = 'amount' in p || 'quantity' in p || 'unitPrice' in p;
  return touchesValue ? { ...next, updatedAt: new Date().toISOString() } : next;
}

const normalizeSymbol = (s: string) => s.trim().toUpperCase();

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
          <button type="button" className="btn-primary" onClick={() => updatePatrimoine((prev) => withHistoryPoint(prev, nowKey, availableWealth(prev)))}>
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
        financial
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
  financial = false,
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
  /** Enables the asset type, quantity × price valuation and online quotes. */
  financial?: boolean;
  focusId: string | null;
  onChange: (fn: (lines: AssetLine[]) => AssetLine[]) => void;
  onAdd: () => void;
  empty?: string;
  muted?: boolean;
  className?: string;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [quoteErrors, setQuoteErrors] = useState<string[]>([]);

  const patch = (id: string, p: Partial<AssetLine>) => onChange((ls) => ls.map((l) => (l.id === id ? patched(l, p) : l)));
  const quotedSymbols = Array.from(
    new Set(lines.filter((l) => l.valuation === 'quantite' && l.quoteSymbol?.trim()).map((l) => normalizeSymbol(l.quoteSymbol!))),
  );

  const refreshQuotes = async () => {
    setRefreshing(true);
    try {
      const results = await Promise.all(quotedSymbols.map(async (s) => [s, await bridge.fetchQuote(s)] as const));
      const errors: string[] = [];
      const prices = new Map<string, { price: number; time: string | null }>();
      for (const [symbol, res] of results) {
        if (!res.ok) errors.push(res.error);
        else if (res.quote.currency !== 'EUR')
          errors.push(`${symbol} est coté en ${res.quote.currency ?? 'devise inconnue'} : choisissez une cotation en euros (ex. VUAA.DE sur Xetra).`);
        else prices.set(symbol, { price: res.quote.price, time: res.quote.time });
      }
      onChange((ls) =>
        ls.map((l) => {
          const q = l.valuation === 'quantite' && l.quoteSymbol ? prices.get(normalizeSymbol(l.quoteSymbol)) : undefined;
          return q ? patched(l, { unitPrice: q.price, quoteAt: q.time ?? new Date().toISOString() }) : l;
        }),
      );
      setQuoteErrors(errors);
      setRefreshedAt(new Date());
    } catch (err) {
      setQuoteErrors([`La récupération des cours a échoué : ${String(err)}`]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card
      className={className}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {financial && quotedSymbols.length > 0 && (
            <div className="flex items-center gap-2">
              {refreshedAt && !refreshing && <span className="text-xs text-muted">à {timeFmt.format(refreshedAt)}</span>}
              <button
                type="button"
                className="btn-secondary py-1"
                disabled={refreshing}
                title={`Récupère sur Yahoo Finance le cours de : ${quotedSymbols.join(', ')}`}
                onClick={() => void refreshQuotes()}
              >
                {refreshing ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualiser les cours
              </button>
            </div>
          )}
          <span className={`tabular text-[15px] font-semibold ${muted ? 'text-ink-2' : 'text-ink'}`}>{formatEURRounded(sumLines(lines))}</span>
        </>
      }
      bodyClassName="px-3 py-2"
    >
      {quoteErrors.length > 0 && (
        <div className="mx-1 mb-2 mt-1 flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-ink" role="alert">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[var(--warning-ink)]" />
          <div className="flex-1 space-y-0.5">
            {quoteErrors.map((e) => (
              <p key={e}>{e}</p>
            ))}
            <p className="text-muted">Vous pouvez toujours saisir le cours à la main.</p>
          </div>
          <button type="button" className="icon-btn -my-1 h-6 w-6" aria-label="Fermer" onClick={() => setQuoteErrors([])}>
            <X size={13} />
          </button>
        </div>
      )}
      {lines.length === 0 && empty && <p className="px-2 py-3 text-sm text-muted">{empty}</p>}
      <ul>
        {lines.map((l) => (
          <AssetRow
            key={l.id}
            line={l}
            financial={financial}
            autoFocus={l.id === focusId}
            onPatch={(p) => patch(l.id, p)}
            onDelete={() => onChange((ls) => ls.filter((x) => x.id !== l.id))}
          />
        ))}
      </ul>
      <button type="button" className="btn-ghost mt-1 text-accent hover:text-accent" onClick={onAdd}>
        <Plus size={16} /> Ajouter
      </button>
    </Card>
  );
}

function AssetRow({
  line,
  financial,
  autoFocus,
  onPatch,
  onDelete,
}: {
  line: AssetLine;
  financial: boolean;
  autoFocus: boolean;
  onPatch: (p: Partial<AssetLine>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const byUnits = financial && line.valuation === 'quantite';
  const info =
    byUnits && line.quoteAt
      ? { text: `cours ${line.quoteSymbol ?? ''} du ${formatDay(line.quoteAt)}`, title: dateTimeFmt.format(new Date(line.quoteAt)) }
      : line.updatedAt
        ? { text: `maj ${formatDay(line.updatedAt)}`, title: dateTimeFmt.format(new Date(line.updatedAt)) }
        : null;

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center gap-2 py-1">
        <div className="min-w-0 flex-1">
          <input
            className="inline-input"
            value={line.label}
            title={line.label}
            placeholder="Nouvelle ligne"
            aria-label="Libellé"
            autoFocus={autoFocus}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
          {info && (
            <div className="px-2 text-[11px] text-muted" title={info.title}>
              {info.text}
            </div>
          )}
        </div>
        {financial && (
          <select
            className="inline-input w-24 shrink-0 text-xs text-ink-2"
            value={line.kind ?? 'liquide'}
            aria-label="Type"
            onChange={(e) => onPatch({ kind: e.target.value as AssetKind })}
          >
            {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((k) => (
              <option key={k} value={k}>
                {ASSET_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        )}
        {financial && (
          <div className="flex w-60 shrink-0 items-center gap-1">
            {byUnits && (
              <>
                <AmountInput
                  className="w-24"
                  suffix=""
                  maxDecimals={8}
                  allowEmpty
                  placeholder="Qté"
                  value={line.quantity ?? null}
                  ariaLabel={`Quantité ${line.label}`}
                  onChange={(v) => onPatch({ quantity: v })}
                />
                <span className="text-xs text-muted">×</span>
                <AmountInput
                  className="w-32"
                  maxDecimals={4}
                  allowEmpty
                  placeholder="Cours"
                  value={line.unitPrice ?? null}
                  ariaLabel={`Cours ${line.label}`}
                  onChange={(v) => onPatch({ unitPrice: v, quoteAt: null })}
                />
              </>
            )}
          </div>
        )}
        {byUnits ? (
          <span
            className="tabular w-32 shrink-0 px-2 text-right font-medium text-ink"
            title={line.quantity == null || line.unitPrice == null ? 'Renseignez la quantité et le cours' : undefined}
            aria-label={`Montant ${line.label}`}
          >
            {formatEUR(line.amount)}
          </span>
        ) : (
          <AmountInput className="w-32 shrink-0" value={line.amount} ariaLabel={`Montant ${line.label}`} onChange={(v) => onPatch({ amount: v ?? 0 })} />
        )}
        {financial && (
          <button
            type="button"
            className={`icon-btn ${open ? 'bg-sunken text-ink' : ''}`}
            title="Options"
            aria-label="Options"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <SlidersHorizontal size={15} />
          </button>
        )}
        <ConfirmDelete onConfirm={onDelete} />
      </div>

      {open && financial && (
        <div className="mb-2 ml-2 mr-1 grid grid-cols-1 gap-3 rounded-lg bg-sunken p-3 md:grid-cols-2">
          <label>
            <span className="label">Valorisation</span>
            <select
              className="field py-1.5"
              value={line.valuation ?? 'montant'}
              onChange={(e) => onPatch({ valuation: e.target.value as 'montant' | 'quantite' })}
            >
              <option value="montant">Montant saisi</option>
              <option value="quantite">Quantité × cours</option>
            </select>
          </label>
          {byUnits && (
            <label>
              <span className="label">Symbole Yahoo Finance pour le cours en ligne (facultatif)</span>
              <input
                className="field py-1.5"
                placeholder="ex. VUAA.DE"
                value={line.quoteSymbol ?? ''}
                onChange={(e) => onPatch({ quoteSymbol: e.target.value })}
              />
              <span className="mt-1 block text-[11px] text-muted">
                Cotation en euros (VUAA.DE = Xetra ; BTC-EUR pour le bitcoin). Seul ce symbole est envoyé, uniquement quand vous cliquez sur
                « Actualiser les cours ».
              </span>
            </label>
          )}
        </div>
      )}
    </li>
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
    onChange((p) => withHistoryPoint(p, month, amount));
    setMonth('');
    setAmount(null);
  };

  return (
    <Card
      className="mt-6"
      title="Évolution du patrimoine financier disponible"
      subtitle="Un point par mois : enregistré à la clôture du mois, avec le bouton ci-dessus, ou saisi à la main."
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
