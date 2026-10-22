import type { DailyPoint, OverviewResponse } from '../api/overview.ts';
import type { SessionStats } from '../contract/types.ts';
import { formatDayFull, formatNumber, formatPercent, modelLabel } from './format.ts';

/**
 * Texto do período. Cada frase nasce de um número que já está no overview; se a
 * fonte daquele número falhou, a frase não existe. Nada é estimado, nada é
 * arredondado para "mais ou menos".
 */

function volumeLine(stats: SessionStats): string {
  const parts = [`${formatNumber(stats.sessions)} sessões`];
  if (stats.subagents > 0) parts.push(`${formatNumber(stats.subagents)} delas subagentes`);
  parts.push(`${formatNumber(stats.prompts)} prompts`);

  return `${parts.join(', ')} e ${formatNumber(stats.steps)} passos no período.`;
}

/** Compara a segunda metade da série com a primeira, contando só dias com passos conhecidos. */
function trendLine(points: DailyPoint[]): string | null {
  const known = points.filter((point) => point.steps !== null);
  if (known.length < 4) return null;

  const middle = Math.ceil(known.length / 2);
  const sum = (slice: DailyPoint[]) => slice.reduce((total, point) => total + (point.steps ?? 0), 0);

  const first = sum(known.slice(0, middle));
  const second = sum(known.slice(middle));
  if (first === 0) return null;

  const change = (second - first) / first;
  if (Math.abs(change) < 0.01) {
    return 'Os passos ficaram estáveis entre a primeira e a segunda metade do período.';
  }

  return `Os passos ${change > 0 ? 'subiram' : 'caíram'} ${formatPercent(
    Math.abs(change),
  )} da primeira para a segunda metade do período.`;
}

function busiestLine(points: DailyPoint[]): string | null {
  let best: DailyPoint | null = null;

  for (const point of points) {
    if (point.steps === null) continue;
    if (best === null || point.steps > (best.steps ?? 0)) best = point;
  }

  if (best === null || (best.steps ?? 0) === 0) return null;

  return `O dia mais ativo foi ${formatDayFull(best.date)}, com ${formatNumber(
    best.steps ?? 0,
  )} passos.`;
}

function costLine(stats: SessionStats): string | null {
  if (stats.models.length === 0) return null;

  const total = stats.models.reduce((sum, entry) => sum + entry.cost, 0);
  if (total <= 0) return null;

  const top = stats.models.reduce((best, entry) => (entry.cost > best.cost ? entry : best));
  const share = top.cost / total;

  if (share >= 0.999) return `Todo o custo do período veio de ${modelLabel(top.model)}.`;

  return `${modelLabel(top.model)} concentra ${formatPercent(share)} do custo do período.`;
}

function failureLine(stats: SessionStats): string | null {
  const tools = stats.tools;
  if (tools.mode !== 'detail') return null;

  const { calls, failed } = tools.totals;
  if (calls === 0) return null;

  if (failed === 0) {
    return `Nenhuma das ${formatNumber(calls)} chamadas de ferramenta falhou.`;
  }

  const worst = tools.usage.reduce<{ name: string; failed: number } | null>((best, tool) => {
    if (tool.failed === 0) return best;
    if (best === null || tool.failed > best.failed) return { name: tool.name, failed: tool.failed };
    return best;
  }, null);

  const base = `${formatNumber(failed)} de ${formatNumber(calls)} chamadas de ferramenta falharam (${formatPercent(
    failed / calls,
  )}).`;

  return worst === null
    ? base
    : `${base} A ferramenta que mais falhou foi ${worst.name}, com ${formatNumber(
        worst.failed,
      )} falhas.`;
}

function activeLine(total: number): string {
  const noun = total === 1 ? 'sessão em execução' : 'sessões em execução';
  return `${formatNumber(total)} ${noun} agora.`;
}

export function buildReading(overview: OverviewResponse): string[] {
  const lines: string[] = [];
  const { stats, daily, active } = overview;

  if (stats.status === 'ok') {
    lines.push(volumeLine(stats.data));
  }

  if (daily.status === 'ok') {
    const trend = trendLine(daily.data.points);
    if (trend) lines.push(trend);

    const busiest = busiestLine(daily.data.points);
    if (busiest) lines.push(busiest);
  }

  if (stats.status === 'ok') {
    const cost = costLine(stats.data);
    if (cost) lines.push(cost);

    const failure = failureLine(stats.data);
    if (failure) lines.push(failure);
  }

  if (active.status === 'ok' && active.data.total > 0) {
    lines.push(activeLine(active.data.total));
  }

  if (daily.status === 'ok' && !daily.data.coversWholePeriod) {
    lines.push(
      'A listagem de sessões não cobriu todo o período, então tokens e custo podem estar abaixo do real.',
    );
  }

  return lines;
}
