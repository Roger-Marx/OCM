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
  formatDuration,
  formatNumber,
  formatPercent,
  shorten,
} from '../../client/format.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { Table, Td, Th } from '../Table.tsx';
import { ChartTooltip } from '../charts/ChartTooltip.tsx';

const AXIS = { fontSize: 11, fill: '#737373' };

/** Chamadas de ferramenta, falhas e latência p50. A fonte é `stats?tools=detail`. */
export function ToolsPanel({ stats }: { stats: Part<SessionStats> }) {
  if (stats.status === 'error') {
    return (
      <Panel title="Ferramentas" description="Chamadas, falhas e latência mediana.">
        <PanelUnavailable message={stats.error.message} />
      </Panel>
    );
  }

  const tools = stats.data.tools;

  if (tools.mode !== 'detail') {
    return (
      <Panel title="Ferramentas" description="Chamadas, falhas e latência mediana.">
        <PanelUnavailable message="O serviço respondeu sem o detalhe das ferramentas nesta leitura." />
      </Panel>
    );
  }

  const usage = [...tools.usage].sort((a, b) => b.calls - a.calls);

  if (usage.length === 0) {
    return (
      <Panel title="Ferramentas" description="Chamadas, falhas e latência mediana.">
        <PanelEmpty message="Nenhuma ferramenta chamada no período selecionado." />
      </Panel>
    );
  }

  const chart = usage.slice(0, 10).map((tool) => ({
    ferramenta: shorten(tool.name, 22),
    chamadas: tool.calls,
  }));

  const failed = tools.totals.failed;
  const calls = tools.totals.calls;

  return (
    <Panel
      title="Ferramentas"
      description="Chamadas, falhas e latência mediana."
      footer={`${formatNumber(calls)} chamadas no período, ${formatNumber(failed)} com falha.`}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickFormatter={formatCompact}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="ferramenta"
                width={140}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip format={formatNumber} />} />
              <Bar
                dataKey="chamadas"
                name="Chamadas"
                fill="#0ea5e9"
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Ferramenta</Th>
              <Th align="right">Chamadas</Th>
              <Th align="right">Falhas</Th>
              <Th align="right">Taxa de falha</Th>
              <Th align="right">p50</Th>
            </tr>
          </thead>
          <tbody>
            {usage.map((tool) => (
              <tr key={tool.name}>
                <Td>{tool.name}</Td>
                <Td align="right">{formatNumber(tool.calls)}</Td>
                <Td align="right">{formatNumber(tool.failed)}</Td>
                <Td align="right">
                  {tool.calls > 0 ? formatPercent(tool.failed / tool.calls) : '—'}
                </Td>
                <Td align="right">
                  {tool.durationP50 === undefined ? '—' : formatDuration(tool.durationP50)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}
