import { ActivityPanel } from './components/charts/ActivityPanel.tsx';
import { CostPanel } from './components/charts/CostPanel.tsx';
import { TokenPanel } from './components/charts/TokenPanel.tsx';
import { KpiSection } from './components/KpiSection.tsx';
import { AgentsPanel } from './components/panels/AgentsPanel.tsx';
import { ModelsPanel } from './components/panels/ModelsPanel.tsx';
import { SessionsPanel } from './components/panels/SessionsPanel.tsx';
import { ToolsPanel } from './components/panels/ToolsPanel.tsx';
import { TopBar, type ServiceState } from './components/TopBar.tsx';
import { useOverview } from './client/useOverview.ts';

export function App() {
  const { period, setPeriod, paused, togglePause, refresh, data, phase, error, lastUpdated } =
    useOverview();

  const service: ServiceState = data ? (data.service.status === 'ok' ? 'ok' : 'error') : 'unknown';

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopBar
        period={period}
        onPeriod={setPeriod}
        paused={paused}
        onTogglePause={togglePause}
        onRefresh={refresh}
        phase={phase}
        service={service}
        lastUpdated={lastUpdated}
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-amber-900">Não consegui atualizar</p>
              <p className="text-sm text-amber-800">{error}</p>
              {data && (
                <p className="mt-1 text-sm text-amber-700">
                  Os números na tela são da última leitura concluída.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-900 hover:border-amber-400"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {data ? (
          <>
            <KpiSection stats={data.stats} />

            <div className="grid gap-4 lg:grid-cols-2">
              <ActivityPanel daily={data.daily} />
              <TokenPanel daily={data.daily} />
            </div>

            <CostPanel daily={data.daily} />

            <ModelsPanel stats={data.stats} />
            <AgentsPanel agents={data.agents} />
            <ToolsPanel stats={data.stats} />
            <SessionsPanel sessions={data.sessions} />

            <section className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
              <h2 className="text-sm font-semibold">De onde vêm os números</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Tokens e custo por dia são calculados a partir das sessões, agrupados pelo dia de
                criação. Os totais do topo vêm do agregado do serviço. Quando as duas fontes
                divergem, cada painel mantém a sua: o topo não é recalculado a partir da série.
              </p>
            </section>
          </>
        ) : (
          <section className="rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center">
            <p className="text-sm text-neutral-500">
              {phase === 'error' ? 'Nenhum dado recebido ainda.' : 'Carregando o overview…'}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
