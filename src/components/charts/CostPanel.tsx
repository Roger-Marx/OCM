import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailySummary, Part } from '../../api/overview.ts';
import { formatCost, formatCostValue, formatDayFull, formatDayShort } from '../../client/format.ts';
import { toCumulativeCost } from '../../client/series.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { ChartTooltip } from './ChartTooltip.tsx';

const AXIS = { fontSize: 11, fill: '#737373' };

/**
 * Custo acumulado no período. Um dia sem custo conhecido interrompe a linha em vez
 * de virar platô: acumulado com buraco não é acumulado.
 */
export function CostPanel({ daily }: { daily: Part<DailySummary> }) {
  if (daily.status === 'error') {
    return (
      <Panel title="Custo acumulado" description="Soma das sessões criadas no período.">
        <PanelUnavailable message={daily.error.message} />
      </Panel>
    );
  }

  const { points, coversWholePeriod } = daily.data;
  const costKnown = points.some((point) => point.cost !== null);

  if (points.length === 0 || !costKnown) {
    return (
      <Panel title="Custo acumulado" description="Soma das sessões criadas no período.">
        {points.length === 0 ? (
          <PanelEmpty message="Nenhum dia no período selecionado." />
        ) : (
          <PanelUnavailable message="A listagem de sessões não respondeu nesta leitura, e é dela que sai a série de custo." />
        )}
      </Panel>
    );
  }

  const data = toCumulativeCost(points);

  return (
    <Panel
      title="Custo acumulado"
      description="Soma das sessões criadas no período."
      footer={
        coversWholePeriod
          ? 'O acumulado começa no primeiro dia do período selecionado.'
          : 'Série parcial: a listagem de sessões não cobriu todo o período.'
      }
    >
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cost-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              tickFormatter={formatCostValue}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip content={<ChartTooltip format={formatCost} labelFormat={formatDayFull} />} />
            <Area
              dataKey="acumulado"
              name="Custo acumulado"
              type="monotone"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#cost-fill)"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
