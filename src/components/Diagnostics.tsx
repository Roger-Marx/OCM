import type { OverviewResponse, Part } from '../api/overview.ts';

/**
 * Bloco temporário da fase 3. Existe para ver, sem abrir o DevTools, o que o
 * endpoint devolveu e qual fonte degradou. Sai quando os painéis de verdade
 * entrarem nas fases 4 a 6.
 */

function stateText(part: Part<unknown>): string {
  return part.status === 'ok' ? 'ok' : part.error.message;
}

function partClass(part: Part<unknown>): string {
  return part.status === 'ok' ? 'text-emerald-700' : 'text-amber-700';
}

export function Diagnostics({ overview }: { overview: OverviewResponse }) {
  const { stats, daily, sessions, agents, active, service, location } = overview;

  const rows: Array<{ label: string; part: Part<unknown>; detail: string }> = [
    {
      label: 'Atividade e consumo',
      part: stats,
      detail:
        stats.status === 'ok'
          ? `${stats.data.sessions} sessões · ${stats.data.steps} passos`
          : '',
    },
    {
      label: 'Série diária',
      part: daily,
      detail:
        daily.status === 'ok'
          ? `${daily.data.points.length} dias${daily.data.coversWholePeriod ? '' : ' · parcial'}`
          : '',
    },
    {
      label: 'Sessões',
      part: sessions,
      detail:
        sessions.status === 'ok'
          ? `${sessions.data.items.length} de ${sessions.data.total}`
          : '',
    },
    {
      label: 'Agentes',
      part: agents,
      detail: agents.status === 'ok' ? `${agents.data.total}` : '',
    },
    {
      label: 'Sessões ativas',
      part: active,
      detail: active.status === 'ok' ? `${active.data.total}` : '',
    },
    {
      label: 'Serviço',
      part: service,
      detail: service.status === 'ok' ? `versão ${service.data.version}` : '',
    },
    {
      label: 'Localização',
      part: location,
      detail: location.status === 'ok' ? location.data.display : '',
    },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold">Diagnóstico do overview</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Bloco temporário da fase 3. Mostra o que o endpoint devolveu e qual fonte falhou.
        </p>
      </div>

      <dl className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
            <dt className="w-44 text-sm text-neutral-600">{row.label}</dt>
            <dd className={`text-sm font-medium ${partClass(row.part)}`}>{stateText(row.part)}</dd>
            {row.detail && <dd className="text-sm text-neutral-500">{row.detail}</dd>}
          </div>
        ))}
      </dl>

      <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
        Período devolvido:{' '}
        {overview.period.from === 0
          ? 'início do histórico'
          : new Date(overview.period.from).toLocaleDateString('pt-BR')}{' '}
        até {new Date(overview.period.to).toLocaleDateString('pt-BR')} · fuso{' '}
        {overview.period.timezone}
      </p>
    </section>
  );
}
