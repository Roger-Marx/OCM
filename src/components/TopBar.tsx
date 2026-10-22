import { PRESETS, PRESET_LABELS, type PeriodPreset } from '../api/overview.ts';
import type { OverviewPhase } from '../client/useOverview.ts';

export type ServiceState = 'ok' | 'error' | 'unknown';

interface TopBarProps {
  period: PeriodPreset;
  onPeriod: (period: PeriodPreset) => void;
  paused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  phase: OverviewPhase;
  service: ServiceState;
  lastUpdated: number | null;
}

const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const SERVICE_COPY: Record<ServiceState, { label: string; dot: string }> = {
  ok: { label: 'Serviço ativo', dot: 'bg-emerald-500' },
  error: { label: 'Serviço indisponível', dot: 'bg-amber-500' },
  unknown: { label: 'Verificando serviço', dot: 'bg-neutral-300' },
};

function updateLabel(phase: OverviewPhase, paused: boolean, lastUpdated: number | null): string {
  if (phase === 'loading') return 'Carregando…';

  if (lastUpdated === null) return 'Sem leitura concluída ainda';

  const time = TIME_FORMAT.format(new Date(lastUpdated));

  if (paused) return `Pausado — atualizado às ${time}`;
  if (phase === 'refreshing') return `Atualizando — última leitura às ${time}`;
  if (phase === 'error') return `Falha na última tentativa — dados de ${time}`;

  return `Atualizado às ${time}`;
}

export function TopBar({
  period,
  onPeriod,
  paused,
  onTogglePause,
  onRefresh,
  phase,
  service,
  lastUpdated,
}: TopBarProps) {
  const status = SERVICE_COPY[service];

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">OpenCode Monitor</h1>
            <p className="text-sm text-neutral-500">
              Atividade, consumo e saúde do OpenCode nesta máquina
            </p>
          </div>

          <p className="flex items-center gap-2 text-sm text-neutral-600" aria-live="polite">
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div
            role="group"
            aria-label="Período"
            className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
          >
            {PRESETS.map((preset) => {
              const selected = preset === period;

              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPeriod(preset)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? 'bg-white font-medium text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            Atualizar
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            aria-pressed={paused}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              paused
                ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900'
            }`}
          >
            {paused ? 'Retomar' : 'Pausar'}
          </button>

          <p className="text-sm text-neutral-500">{updateLabel(phase, paused, lastUpdated)}</p>
        </div>
      </div>
    </header>
  );
}
