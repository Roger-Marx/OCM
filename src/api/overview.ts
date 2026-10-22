import type { EpochMs, SessionStats, TokenUsage, Usd } from '../contract/types.ts';

/**
 * Contrato do endpoint `/oc-api/overview` — o que o navegador recebe.
 *
 * Vive fora de `src/server` de propósito: o cliente importa daqui, e nada deste
 * arquivo puxa `node:*`. Sem isso, um `import` de tipo no cliente arrastaria o
 * servidor para o bundle.
 */

export type PeriodPreset = '1d' | '7d' | '30d' | '90d' | 'all';

export const PRESETS: readonly PeriodPreset[] = ['1d', '7d', '30d', '90d', 'all'];

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  '1d': '1 dia',
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  all: 'Tudo',
};

export interface Period {
  preset: PeriodPreset;
  from: EpochMs;
  to: EpochMs;
  timezone: string;
}

export type OverviewErrorKind =
  | 'cli-missing'
  | 'unauthorized'
  | 'route-missing'
  | 'timeout'
  | 'invalid-json'
  | 'http-error'
  | 'cli-error'
  | 'invalid-input';

export interface OverviewError {
  kind: OverviewErrorKind;
  message: string;
}

/**
 * Uma fonte do overview. `error` é estado do painel, não da tela: o resto do
 * dashboard continua com o que respondeu.
 */
export type Part<T> = { status: 'ok'; data: T } | { status: 'error'; error: OverviewError };

export interface SessionSummary {
  id: string;
  parentID?: string;
  agent?: string;
  model?: { id: string; providerID: string; variant?: string };
  cost: Usd;
  tokens: TokenUsage;
  outcome?: 'succeeded' | 'failed' | 'interrupted';
  created: EpochMs;
  updated: EpochMs;
  title?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  mode: 'subagent' | 'primary' | 'all';
  hidden: boolean;
  model?: { id: string; providerID: string; variant?: string };
  steps?: number;
}

export interface ServiceSummary {
  version: string;
  pid: number;
  persistentPty: boolean | null;
}

/** Campo é `null` quando a fonte daquele número não respondeu. Zero é dado. */
export interface DailyPoint {
  date: string;
  steps: number | null;
  sessionsStarted: number | null;
  tokens: TokenUsage | null;
  cost: Usd | null;
}

export interface DailySummary {
  points: DailyPoint[];
  coversWholePeriod: boolean;
}

/** Tudo que os dois lados compartilham. A localização muda de forma no caminho. */
export interface OverviewBase {
  requestedAt: EpochMs;
  period: Period;
  stats: Part<SessionStats>;
  daily: Part<DailySummary>;
  sessions: Part<{ items: SessionSummary[]; total: number; complete: boolean }>;
  agents: Part<{ total: number; items: AgentSummary[] }>;
  active: Part<{ total: number }>;
  service: Part<ServiceSummary>;
}

/** Corpo devolvido pelo endpoint: caminho já abreviado pelo servidor. */
export type OverviewResponse = OverviewBase & { location: Part<{ display: string }> };
