import type {
  ActiveSessionsResponse,
  AgentListResponse,
  InfoResponse,
  LocationResponse,
  SessionInfo,
  SessionListResponse,
  SessionStats,
  StatsResponse,
} from '../../contract/types.ts';
import type {
  AgentSummary,
  DailySummary,
  OverviewBase,
  OverviewError,
  Part,
  Period,
  SessionSummary,
} from '../../api/overview.ts';
import { fetchRoute, type ErrorKind, type RouteError, type RouteFetcher } from './cli.ts';
import { buildDaily, dayKey, daysBetween, observedSpan } from './daily.ts';
import { resolvePeriod, type PeriodInput } from './period.ts';

export type {
  AgentSummary,
  DailyPoint,
  DailySummary,
  OverviewError,
  OverviewResponse,
  Part,
  Period,
  PeriodPreset,
  SessionSummary,
} from '../../api/overview.ts';

/**
 * Overview interno. Difere do corpo público em um ponto só: aqui a localização
 * carrega o caminho cru, que o middleware abrevia antes de responder.
 */
export type Overview = OverviewBase & { location: Part<{ directory: string }> };

export interface OverviewRequest extends PeriodInput {}

export interface OverviewDeps {
  fetchRoute?: RouteFetcher;
  now?: () => number;
}

export interface OverviewClient {
  getOverview(
    request: OverviewRequest,
  ): Promise<{ ok: true; overview: Overview } | { ok: false; error: OverviewError }>;
  clearCache(): void;
}

export const CACHE_TTL_MS = 10_000;
export const SESSION_PAGE_LIMIT = 100;
export const SESSION_MAX_PAGES = 50;
export const RECENT_SESSIONS = 20;
const TITLE_MAX = 80;

const MESSAGES: Record<ErrorKind, string> = {
  'cli-missing': 'Não encontrei o comando opencode no PATH.',
  unauthorized: 'O serviço recusou a autenticação.',
  'route-missing': 'Esta rota não existe na versão instalada do OpenCode.',
  timeout: 'O serviço demorou mais que o limite e a consulta foi interrompida.',
  'invalid-json': 'O serviço respondeu algo que não é JSON.',
  'http-error': 'O serviço respondeu com erro.',
  'cli-error': 'O comando opencode falhou.',
};

function toOverviewError(error: RouteError): OverviewError {
  return { kind: error.kind, message: MESSAGES[error.kind] };
}

function statsRoute(period: Period): string {
  const query = new URLSearchParams({
    from: String(period.from),
    to: String(period.to),
    timezone: period.timezone,
    tools: 'detail',
  });
  return `/api/experimental/session/stats?${query.toString()}`;
}

interface Collected {
  items: SessionInfo[];
  /** `false` quando parou no teto de páginas ou falhou depois da primeira página. */
  complete: boolean;
  error?: RouteError;
}

/**
 * Percorre a listagem por cursor. A última página com dados ainda traz `next`
 * preenchido, então a parada é página vazia ou cursor repetido — nunca `next` nulo.
 */
async function collectSessions(
  fetcher: RouteFetcher,
  period: Period,
  maxPages = SESSION_MAX_PAGES,
): Promise<Collected> {
  const items: SessionInfo[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ limit: String(SESSION_PAGE_LIMIT), order: 'desc' });
    if (cursor) query.set('cursor', cursor);

    const result = await fetcher<SessionListResponse>(`/api/session?${query.toString()}`);
    if (!result.ok) {
      return { items, complete: false, error: result.error };
    }

    const batch = result.data.data;
    if (batch.length === 0) {
      return { items, complete: true };
    }

    items.push(...batch);

    // `order=desc`: quando a página inteira é anterior ao início, não há mais nada no período.
    const oldest = batch[batch.length - 1];
    if (period.from > 0 && oldest && oldest.time.created < period.from) {
      return { items, complete: true };
    }

    const next = result.data.cursor?.next;
    if (!next || seenCursors.has(next)) {
      return { items, complete: true };
    }

    seenCursors.add(next);
    cursor = next;
  }

  return { items, complete: false };
}

function truncateTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) return undefined;
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1)}…` : clean;
}

function summarizeSession(session: SessionInfo): SessionSummary {
  return {
    id: session.id,
    parentID: session.parentID,
    agent: session.agent,
    model: session.model,
    cost: session.cost,
    tokens: session.tokens,
    outcome: session.outcome,
    created: session.time.created,
    updated: session.time.updated,
    title: truncateTitle(session.title),
  };
}

function summarizeAgents(result: AgentListResponse): { total: number; items: AgentSummary[] } {
  const items = result.data.map((agent) => ({
    id: agent.id,
    name: agent.name,
    mode: agent.mode,
    hidden: agent.hidden,
    model: agent.model,
    steps: agent.steps,
  }));

  return { total: items.length, items };
}

async function load(period: Period, deps: Required<OverviewDeps>): Promise<Overview> {
  const { fetchRoute: fetcher, now } = deps;
  const requestedAt = now();

  const [info, location, agents, active, stats, collected] = await Promise.all([
    fetcher<InfoResponse>('/api/info'),
    fetcher<LocationResponse>('/api/location'),
    fetcher<AgentListResponse>('/api/agent'),
    fetcher<ActiveSessionsResponse>('/api/session/active'),
    fetcher<StatsResponse>(statsRoute(period)),
    collectSessions(fetcher, period),
  ]);

  const inPeriod = collected.items.filter(
    (session) => session.time.created >= period.from && session.time.created < period.to,
  );

  const hasStats = stats.ok;
  const hasSessions = !(collected.error && collected.items.length === 0);

  let dates: string[] = [];
  if (period.preset === 'all') {
    const span = observedSpan(hasStats ? stats.data.data.activity : null, hasSessions ? inPeriod : null, period.timezone);
    dates = span ? daysBetween(span.first, span.last) : [];
  } else {
    // `to` é exclusivo: o último instante do período é `to - 1`. Sem isso, uma janela
    // que termina exatamente na meia-noite local ganha um dia vazio no gráfico.
    const lastInstant = Math.max(period.to - 1, period.from);
    dates = daysBetween(dayKey(period.from, period.timezone), dayKey(lastInstant, period.timezone));
  }

  const points = buildDaily({
    dates,
    activity: hasStats ? stats.data.data.activity : null,
    sessions: hasSessions ? inPeriod : null,
    timeZone: period.timezone,
  });

  const daily: Part<DailySummary> =
    hasStats || hasSessions
      ? {
          status: 'ok',
          data: { points, coversWholePeriod: collected.complete },
        }
      : {
          status: 'error',
          error: collected.error ? toOverviewError(collected.error) : { kind: 'cli-error', message: MESSAGES['cli-error'] },
        };

  const sessionsPart: Part<{ items: SessionSummary[]; total: number; complete: boolean }> =
    collected.error && collected.items.length === 0
      ? { status: 'error', error: toOverviewError(collected.error) }
      : {
          status: 'ok',
          data: {
            items: [...inPeriod]
              .sort((a, b) => b.time.created - a.time.created)
              .slice(0, RECENT_SESSIONS)
              .map(summarizeSession),
            total: inPeriod.length,
            complete: collected.complete,
          },
        };

  return {
    requestedAt,
    period,
    stats: stats.ok
      ? { status: 'ok', data: stats.data.data }
      : { status: 'error', error: toOverviewError(stats.error) },
    daily,
    sessions: sessionsPart,
    agents: agents.ok
      ? { status: 'ok', data: summarizeAgents(agents.data) }
      : { status: 'error', error: toOverviewError(agents.error) },
    active: active.ok
      ? { status: 'ok', data: { total: Object.keys(active.data.data).length } }
      : { status: 'error', error: toOverviewError(active.error) },
    service: info.ok
      ? {
          status: 'ok',
          data: {
            version: info.data.version,
            pid: info.data.pid,
            persistentPty: info.data.capabilities?.persistentPty ?? null,
          },
        }
      : { status: 'error', error: toOverviewError(info.error) },
    location: location.ok
      ? { status: 'ok', data: { directory: location.data.directory } }
      : { status: 'error', error: toOverviewError(location.error) },
  };
}

export function createOverview(deps: OverviewDeps = {}): OverviewClient {
  const resolved: Required<OverviewDeps> = {
    fetchRoute: deps.fetchRoute ?? fetchRoute,
    now: deps.now ?? (() => Date.now()),
  };

  const cache = new Map<string, { expiresAt: number; value: Promise<Overview> }>();

  const keyFor = (request: OverviewRequest, period: Period): string => {
    if (request.from !== undefined || request.to !== undefined) {
      return `window:${period.from}:${period.to}:${period.timezone}`;
    }
    return `preset:${period.preset}:${period.timezone}`;
  };

  return {
    async getOverview(request) {
      const period = resolvePeriod(request, resolved.now());
      if (!period.ok) {
        return {
          ok: false,
          error: { kind: 'invalid-input', message: period.error.message },
        };
      }

      const key = keyFor(request, period.period);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > resolved.now()) {
        return { ok: true, overview: await cached.value };
      }

      const value = load(period.period, resolved);
      cache.set(key, { expiresAt: resolved.now() + CACHE_TTL_MS, value });

      return { ok: true, overview: await value };
    },

    clearCache() {
      cache.clear();
    },
  };
}
