import type { Part } from '../api/overview.ts';
import type { SessionStats } from '../contract/types.ts';
import { formatCost, formatNumber } from '../client/format.ts';
import { Panel, PanelUnavailable } from './Panel.tsx';

function KpiCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-neutral-500">{detail}</p>}
    </div>
  );
}

/**
 * Totais do período. Todos vêm de `stats`, a fonte agregada do serviço — inclusive
 * tokens e custo, como o PRD define. A série diária tem outra origem; a nota no fim
 * da página diz isso.
 */
export function KpiSection({ stats }: { stats: Part<SessionStats> }) {
  if (stats.status === 'error') {
    return (
      <Panel title="Indicadores do período">
        <PanelUnavailable message={stats.error.message} />
      </Panel>
    );
  }

  const data = stats.data;
  const cache = data.tokens.cache.read + data.tokens.cache.write;
  const cacheDetail =
    data.tokens.cache.write > 0
      ? `${formatNumber(data.tokens.cache.read)} lidos · ${formatNumber(data.tokens.cache.write)} escritos`
      : undefined;

  return (
    <section aria-label="Indicadores do período" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard label="Sessões" value={formatNumber(data.sessions)} detail="sem subagentes" />
      <KpiCard label="Subagentes" value={formatNumber(data.subagents)} detail="sessões filhas" />
      <KpiCard label="Prompts" value={formatNumber(data.prompts)} />
      <KpiCard label="Passos" value={formatNumber(data.steps)} />
      <KpiCard label="Custo" value={formatCost(data.cost)} detail="fonte: agregado do serviço" />

      <KpiCard label="Tokens de entrada" value={formatNumber(data.tokens.input)} />
      <KpiCard label="Tokens de saída" value={formatNumber(data.tokens.output)} />
      <KpiCard label="Tokens de raciocínio" value={formatNumber(data.tokens.reasoning)} />
      <KpiCard label="Tokens em cache" value={formatNumber(cache)} detail={cacheDetail} />
    </section>
  );
}
