import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactEUR, formatEURRounded } from '../lib/format';

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

interface Props {
  data: TrendPoint[];
  seriesName: string;
  color?: string;
  height?: number;
  emptyText?: string;
  onPointClick?: (key: string) => void;
}

interface TooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TrendPoint }>;
}

function ChartTooltip({ active, payload, seriesName }: TooltipArgs & { seriesName: string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-0.5 text-muted">{point.label}</div>
      <div className="tabular font-semibold text-ink">
        {seriesName} : {formatEURRounded(point.value)}
      </div>
    </div>
  );
}

export function TrendChart({ data, seriesName, color = 'var(--series-1)', height = 220, emptyText, onPointClick }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-sunken px-6 text-center text-sm text-muted" style={{ height }}>
        {emptyText ?? 'Il faut au moins deux mois de données pour tracer une courbe.'}
      </div>
    );
  }
  const hasNegative = data.some((d) => d.value < 0);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
          onClick={(state) => {
            const idx = state?.activeTooltipIndex;
            if (onPointClick && idx !== undefined && idx !== null) onPointClick(data[Number(idx)].key);
          }}
          style={{ cursor: onPointClick ? 'pointer' : undefined }}
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactEUR(v)}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          {hasNegative && <ReferenceLine y={0} stroke="var(--baseline)" />}
          <Tooltip
            cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
            content={(props: TooltipArgs) => <ChartTooltip {...props} seriesName={seriesName} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={seriesName}
            stroke={color}
            strokeWidth={2}
            dot={data.length <= 24 ? { r: 3, fill: color, strokeWidth: 2, stroke: 'var(--surface)' } : false}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
