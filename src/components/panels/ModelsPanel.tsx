import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Part } from '../../api/overview.ts';
import type { SessionStats } from '../../contract/types.ts';
import {
  formatCompact,
  formatCost,
  formatNumber,
  modelLabel,
  shorten,
} from '../../client/format.ts';
import { totalTokens } from '../../client/series.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { Table, Td, Th } from '../Table.tsx';
import { ChartTooltip } from '../charts/ChartTooltip.tsx';

const AXIS = { fontSize: 11, fill: '#737373' };

/** Ranking de modelos por passos, com a tabela ao lado. */
export function ModelsPanel({ stats }: { stats: Part<SessionStats> }) {
  if (stats.status === 'error') {
    return (
      <Panel title="Modelos" description="Passos por modelo no período.">
        <PanelUnavailable message={stats.error.message} />
      </Panel>
    );
  }

  const models = [...stats.data.models].sort((a, b) => b.steps - a.steps);

  if (models.length === 0) {
    return (
      <Panel title="Modelos" description="Passos por modelo no período.">
        <PanelEmpty message="Nenhum modelo registrado no período selecionado." />
      </Panel>
    );
  }

  const chart = models.slice(0, 8).map((entry) => ({
    modelo: shorten(entry.model.id, 22),
    passos: entry.steps,
  }));

  return (
    <Panel title="Modelos" description="Passos por modelo no período.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatCompact}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="modelo"
                width={140}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip format={formatNumber} />} />
              <Bar
                dataKey="passos"
                name="Passos"
                fill="#6366f1"
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Modelo</Th>
              <Th>Provedor</Th>
              <Th align="right">Passos</Th>
              <Th align="right">Tokens</Th>
              <Th align="right">Custo</Th>
            </tr>
          </thead>
          <tbody>
            {models.map((entry) => (
              <tr key={`${entry.model.providerID}/${entry.model.id}/${entry.model.variant ?? ''}`}>
                <Td>{modelLabel(entry.model)}</Td>
                <Td muted>{entry.model.providerID}</Td>
                <Td align="right">{formatNumber(entry.steps)}</Td>
                <Td align="right">{formatNumber(totalTokens(entry.tokens))}</Td>
                <Td align="right">{formatCost(entry.cost)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}
