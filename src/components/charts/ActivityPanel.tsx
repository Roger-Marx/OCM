import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailySummary, Part } from '../../api/overview.ts';
import { formatCompact, formatDayFull, formatDayShort, formatNumber } from '../../client/format.ts';
import { toActivitySeries } from '../../client/series.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { ChartTooltip } from './ChartTooltip.tsx';

const AXIS = { fontSize: 11, fill: '#737373' };
const LEGEND = { fontSize: 12, color: '#525252' };

/** Passos por dia em barra; sessões iniciadas em linha, eixo próprio. */
export function ActivityPanel({ daily }: { daily: Part<DailySummary> }) {
  if (daily.status === 'error') {
    return (
      <Panel title="Atividade" description="Passos por dia e sessões iniciadas.">
        <PanelUnavailable message={daily.error.message} />
      </Panel>
    );
  }

  const { points, coversWholePeriod } = daily.data;
  const stepsKnown = points.some((point) => point.steps !== null);
  const sessionsKnown = points.some((point) => point.sessionsStarted !== null);

  if (points.length === 0 || (!stepsKnown && !sessionsKnown)) {
    return (
      <Panel title="Atividade" description="Passos por dia e sessões iniciadas.">
        {points.length === 0 ? (
          <PanelEmpty message="Nenhum dia no período selecionado." />
        ) : (
          <PanelUnavailable message="A atividade diária e a listagem de sessões não responderam nesta leitura." />
        )}
      </Panel>
    );
  }

  const data = toActivitySeries(points);

  return (
    <Panel
      title="Atividade"
      description="Passos por dia e sessões iniciadas."
      footer={coversWholePeriod ? undefined : 'Série parcial: a listagem de sessões não cobriu todo o período.'}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
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
              yAxisId="steps"
              tickFormatter={formatCompact}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            {sessionsKnown && (
              <YAxis
                yAxisId="sessions"
                orientation="right"
                allowDecimals={false}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={32}
              />
            )}
            <Tooltip content={<ChartTooltip format={formatNumber} labelFormat={formatDayFull} />} />
            <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
            {stepsKnown && (
              <Bar
                yAxisId="steps"
                dataKey="passos"
                name="Passos"
                fill="#6366f1"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            )}
            {sessionsKnown && (
              <Line
                yAxisId="sessions"
                dataKey="sessoes"
                name="Sessões iniciadas"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
