import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailySummary, Part } from '../../api/overview.ts';
import { formatCompact, formatDayFull, formatDayShort, formatNumber } from '../../client/format.ts';
import { toTokenSeries } from '../../client/series.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { ChartTooltip } from './ChartTooltip.tsx';

const AXIS = { fontSize: 11, fill: '#737373' };
const LEGEND = { fontSize: 12, color: '#525252' };

const SERIES = [
  { key: 'entrada', label: 'Entrada', color: '#6366f1' },
  { key: 'saida', label: 'Saída', color: '#22c55e' },
  { key: 'raciocinio', label: 'Raciocínio', color: '#a855f7' },
  { key: 'cache', label: 'Cache', color: '#94a3b8' },
] as const;

/** Tokens por dia, empilhados por tipo. Cache soma leitura e escrita. */
export function TokenPanel({ daily }: { daily: Part<DailySummary> }) {
  if (daily.status === 'error') {
    return (
      <Panel title="Tokens por dia" description="Empilhado por tipo, no dia de criação da sessão.">
        <PanelUnavailable message={daily.error.message} />
      </Panel>
    );
  }

  const { points, coversWholePeriod } = daily.data;
  const tokensKnown = points.some((point) => point.tokens !== null);

  if (points.length === 0 || !tokensKnown) {
    return (
      <Panel title="Tokens por dia" description="Empilhado por tipo, no dia de criação da sessão.">
        {points.length === 0 ? (
          <PanelEmpty message="Nenhum dia no período selecionado." />
        ) : (
          <PanelUnavailable message="A listagem de sessões não respondeu nesta leitura, e é dela que sai a série de tokens." />
        )}
      </Panel>
    );
  }

  const data = toTokenSeries(points);

  return (
    <Panel
      title="Tokens por dia"
      description="Empilhado por tipo, no dia de criação da sessão."
      footer={
        coversWholePeriod
          ? 'Soma por dia de criação da sessão. Cache inclui leitura e escrita.'
          : 'Série parcial: a listagem de sessões não cobriu todo o período.'
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayShort}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: '#e5e5e5' }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<ChartTooltip format={formatNumber} labelFormat={formatDayFull} />} />
            <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
            {SERIES.map((serie) => (
              <Bar
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                stackId="tokens"
                fill={serie.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
