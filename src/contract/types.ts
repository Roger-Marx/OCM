/**
 * Contrato das rotas do OpenCode que o dashboard consome.
 *
 * Fonte: `/openapi.json` do serviço local (OpenAPI 3.1.0, 119 rotas) e observação
 * direta das respostas em 2026-10-22. Onde o OpenAPI é omisso ou divergente, o
 * comentário diz o que foi observado — vale a observação.
 *
 * Este arquivo é só contrato: nenhuma lógica, nenhum acesso a rede.
 * Regras de degradação, cache e agregação ficam na camada de dados (fase 1).
 */

/** Milissegundos desde a época. `time.created`, `range.from`, `range.to`. */
export type EpochMs = number;

/** Dólar americano, fração cheia (0.0000596 = US$ 0,0000596). */
export type Usd = number;

/** Duração em milissegundos. Inferido: p50 máximo observado de 124503 só faz sentido em ms. */
export type Milliseconds = number;

/** Data no formato `YYYY-MM-DD`, no fuso pedido em `timezone`. */
export type IsoDate = string;

export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
  cache: {
    read: number;
    write: number;
  };
}

export interface ModelRef {
  id: string;
  providerID: string;
  variant?: string;
}

/** GET /api/info */
export interface InfoResponse {
  version: string;
  pid: number;
  urls: string[];
  /** `tmp` é caminho local: não exibir em log nem mandar ao navegador. */
  paths: { tmp: string };
  capabilities?: { persistentPty?: boolean | null } | null;
}

export interface StatsRange {
  from: EpochMs;
  /** Eco do `to` enviado. O intervalo trata o fim como exclusivo nos dias. */
  to: EpochMs;
}

export interface ToolTotals {
  calls: number;
  succeeded: number;
  failed: number;
  unfinished: number;
}

export interface ToolUsage extends ToolTotals {
  name: string;
  /** Opcional no schema; veio em todas as amostras. Unidade: ms. */
  durationP50?: Milliseconds;
}

/**
 * União discriminada por `mode`. `summary` vem quando `tools` é omitido;
 * `detail` só quando `tools=detail` é pedido explicitamente.
 */
export type StatsTools =
  | { mode: 'none' }
  | { mode: 'summary'; totals: ToolTotals }
  | { mode: 'detail'; totals: ToolTotals; usage: ToolUsage[] };

export interface ModelStat {
  model: ModelRef;
  steps: number;
  tokens: TokenUsage;
  cost: Usd;
}

export interface ActivityDay {
  date: IsoDate;
  steps: number;
}

/** GET /api/experimental/session/stats */
export interface SessionStats {
  range: StatsRange;
  /** Sessões raiz. Não inclui subagentes: `sessions + subagents` = total listado em /api/session. */
  sessions: number;
  subagents: number;
  prompts: number;
  steps: number;
  tokens: TokenUsage;
  /**
   * Divergência observada: este campo veio 0 em todas as faixas, enquanto a soma de
   * `cost` das sessões foi 0.0006127. O KPI usa este campo; a série diária usa as
   * sessões, como o PRD define. Ver docs/api-contract.md.
   */
  cost: Usd;
  tools: StatsTools;
  activeDays: number;
  /** Não está no PRD; só existe aqui para não perder o campo do contrato. */
  streak: number;
  /** Esparso: só dias com atividade. Preencher os dias faltantes na interface. */
  activity: ActivityDay[];
  models: ModelStat[];
}

export interface StatsResponse {
  data: SessionStats;
}

export interface SessionTime {
  created: EpochMs;
  updated: EpochMs;
  idle?: EpochMs;
  viewed?: EpochMs;
  archived?: EpochMs;
}

/** GET /api/session */
export interface SessionInfo {
  id: string;
  parentID?: string;
  projectID: string;
  agent?: string;
  model?: ModelRef;
  cost: Usd;
  tokens: TokenUsage;
  outcome?: 'succeeded' | 'failed' | 'interrupted';
  time: SessionTime;
  /** Texto livre do usuário. Não é para log; truncar na interface. */
  title?: string;
  subpath?: string;
  metadata?: unknown;
  permissions?: unknown;
  revert?: unknown;
  /** Caminho absoluto da sessão. Não exibir integralmente. */
  location: { directory: string };
}

export interface SessionListResponse {
  data: SessionInfo[];
  /**
   * Cursor opaco. A última página ainda trouxe `next` preenchido, e a página seguinte
   * veio vazia: pare quando a página vier vazia, não quando `next` for nulo.
   */
  cursor: {
    previous?: string | null;
    next?: string | null;
  };
}

/** GET /api/agent */
export interface AgentInfo {
  id: string;
  name: string;
  model?: ModelRef;
  /** Não consumido pelo dashboard. */
  request?: unknown;
  system?: string;
  description?: string;
  mode: 'subagent' | 'primary' | 'all';
  hidden: boolean;
  color?: string;
  steps?: number;
  /** Não consumido pelo dashboard. */
  permissions?: unknown;
}

export interface AgentListResponse {
  location: { directory: string };
  /** Vazio neste ambiente para a localização padrão. Contagem = `data.length`. */
  data: AgentInfo[];
}

/**
 * GET /api/session/active
 *
 * O OpenAPI declara `data: {}`, sem restrição. A forma abaixo veio da observação:
 * mapa por ID de sessão, e o único `type` visto foi `running`.
 */
export interface ActiveSessionState {
  type: string;
}

export interface ActiveSessionsResponse {
  data: Record<string, ActiveSessionState>;
}

/** GET /api/location */
export interface LocationResponse {
  directory: string;
  project: {
    id: string;
    directory: string;
    canonical: string;
  };
}

/** Corpo de erro. `_tag` aparece também em 400 e 401. */
export interface ApiError {
  _tag: string;
  message: string;
  kind?: string | null;
  field?: string | null;
}
