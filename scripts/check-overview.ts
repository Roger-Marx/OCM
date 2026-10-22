/**
 * Verificação da fase 1. Roda uma vez contra o serviço real e o resto contra
 * dublês, para cobrir degradação sem derrubar o OpenCode de ninguém.
 *
 *   node scripts/check-overview.ts
 */
import assert from 'node:assert/strict';
import { createOverview } from '../src/server/opencode/index.ts';
import type { RouteFetcher, RouteResult } from '../src/server/opencode/cli.ts';
import type { SessionStats } from '../src/contract/types.ts';

const TZ = 'America/Sao_Paulo';
const DAY = 86_400_000;
const NOW = Date.parse('2026-10-22T15:00:00Z');

let checks = 0;
function pass(label: string, detail = ''): void {
  checks += 1;
  console.log(`ok   ${label}${detail ? ` — ${detail}` : ''}`);
}

function zeroStats(activity: { date: string; steps: number }[], sessions: number): SessionStats {
  return {
    range: { from: 0, to: NOW },
    sessions,
    subagents: 0,
    prompts: 0,
    steps: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    cost: 0,
    tools: { mode: 'detail', totals: { calls: 0, succeeded: 0, failed: 0, unfinished: 0 }, usage: [] },
    activeDays: activity.length,
    streak: 0,
    activity,
    models: [],
  };
}

function sessionAt(id: string, created: number, tokens: number, cost: number) {
  return {
    id,
    projectID: 'proj',
    cost,
    tokens: { input: tokens, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created, updated: created },
    location: { directory: '<caminho>' },
  };
}

interface Fake {
  fail?: Partial<Record<string, 'cli-missing' | 'route-missing' | 'timeout'>>;
  calls: number;
  lastRoutes: string[];
}

function fakeFetcher(overrides: Record<string, unknown> = {}, fail: Fake['fail'] = {}): { fetcher: RouteFetcher; fake: Fake } {
  const fake: Fake = { fail, calls: 0, lastRoutes: [] };

  const body: Record<string, unknown> = {
    '/api/info': {
      version: '2.0.0',
      pid: 1234,
      urls: ['http://localhost:4096'],
      paths: { tmp: '<caminho>' },
      capabilities: { persistentPty: true },
    },
    '/api/location': {
      directory: '<caminho>',
      project: { id: 'proj', directory: '<caminho>', canonical: '<caminho>' },
    },
    '/api/agent': { location: { directory: '<caminho>' }, data: [] },
    '/api/session/active': { data: { ses_a: { type: 'running' } } },
    '/api/experimental/session/stats': { data: zeroStats([{ date: '2026-10-21', steps: 169 }], 8) },
    ...overrides,
  };

  const fetcher: RouteFetcher = async <T,>(route: string): Promise<RouteResult<T>> => {
    fake.calls += 1;
    fake.lastRoutes.push(route);

    const path = route.split('?')[0] ?? route;
    const kind = fake.fail?.[path];

    if (kind) {
      return { ok: false, error: { kind, detail: 'falha simulada em <caminho>' } };
    }

    const payload = body[path];
    if (payload === undefined) {
      return { ok: false, error: { kind: 'route-missing', detail: 'sem dublê' } };
    }

    return { ok: true, data: payload as T };
  };

  return { fetcher, fake };
}

// 1. Serviço real.
{
  const client = createOverview();
  const result = await client.getOverview({ preset: '30d' });

  assert.ok(result.ok, 'overview real falhou');
  const parts = result.overview;

  const statuses = (
    ['stats', 'daily', 'sessions', 'agents', 'active', 'service', 'location'] as const
  ).map((key) => `${key}=${parts[key].status}`);

  assert.equal(parts.stats.status, 'ok', `stats: ${StatusDetail(parts.stats)}`);
  assert.equal(parts.daily.status, 'ok');
  assert.equal(parts.service.status, 'ok');

  pass('serviço real', statuses.join(' '));

  if (parts.stats.status === 'ok' && parts.daily.status === 'ok') {
    pass(
      'série real',
      `${parts.daily.data.points.length} dias, ${parts.stats.data.sessions} sessões, ${parts.stats.data.tools.mode}`,
    );
  }

  if (parts.sessions.status === 'ok') {
    pass('sessões reais', `${parts.sessions.data.items.length} recentes de ${parts.sessions.data.total}`);
  }
}

function StatusDetail(part: { status: string; error?: { message: string } }): string {
  return part.status === 'error' && part.error ? part.error.message : 'ok';
}

// 2. Cache: duas requisições em menos de 10 s chamam o CLI uma vez.
{
  const { fetcher, fake } = fakeFetcher({
    '/api/session': { data: [sessionAt('ses_a', NOW - DAY, 100, 0.01)], cursor: { next: null } },
  });
  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });

  await client.getOverview({ preset: '7d', timezone: TZ });
  const afterFirst = fake.calls;
  await client.getOverview({ preset: '7d', timezone: TZ });

  assert.equal(fake.calls, afterFirst, 'segunda requisição bateu no CLI');
  assert.equal(afterFirst, 6, `esperava 6 chamadas, veio ${afterFirst}`);
  pass('cache de 10 s', `${afterFirst} chamadas para 2 requisições`);
}

// 3. Degradação total: nada responde, nada lança.
{
  const { fetcher } = fakeFetcher({}, {
    '/api/info': 'cli-missing',
    '/api/location': 'cli-missing',
    '/api/agent': 'cli-missing',
    '/api/session/active': 'cli-missing',
    '/api/experimental/session/stats': 'cli-missing',
    '/api/session': 'cli-missing',
  });
  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });
  const result = await client.getOverview({ preset: '7d', timezone: TZ });

  assert.ok(result.ok, 'degradação total lançou');
  const parts = result.overview;
  for (const key of ['stats', 'sessions', 'agents', 'active', 'service', 'location'] as const) {
    assert.equal(parts[key].status, 'error', `${key} deveria estar em erro`);
  }
  assert.equal(parts.daily.status, 'error', 'daily sem fonte deveria estar em erro');

  const serialized = JSON.stringify(parts);
  assert.ok(!serialized.includes('C:\\'), 'vazou caminho absoluto');
  assert.ok(!serialized.includes('falha simulada'), 'vazou detalhe do CLI');
  pass('degradação total', 'sete partes em erro, nenhum detalhe vazado');
}

// 4. Degradação parcial: só a rota experimental falha.
{
  const { fetcher } = fakeFetcher(
    { '/api/session': { data: [sessionAt('ses_a', NOW - DAY, 100, 0.01)], cursor: { next: null } } },
    { '/api/experimental/session/stats': 'route-missing' },
  );
  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });
  const result = await client.getOverview({ preset: '7d', timezone: TZ });

  assert.ok(result.ok);
  const parts = result.overview;
  assert.equal(parts.stats.status, 'error');
  assert.equal(parts.daily.status, 'ok', 'daily deveria sobreviver sem stats');
  assert.equal(parts.service.status, 'ok');

  if (parts.daily.status === 'ok') {
    assert.ok(parts.daily.data.points.every((point) => point.steps === null), 'steps deveria ser nulo');
    assert.ok(parts.daily.data.points.some((point) => point.sessionsStarted === 1), 'sessões deveriam contar');
  }
  pass('degradação parcial', 'stats em erro, série com steps nulo');
}

// 5. Série diária agrupa por dia do fuso.
{
  const { fetcher } = fakeFetcher({
    '/api/experimental/session/stats': {
      data: zeroStats(
        [
          { date: '2026-10-20', steps: 10 },
          { date: '2026-10-21', steps: 20 },
        ],
        3,
      ),
    },
    '/api/session': {
      data: [
        sessionAt('ses_a', Date.parse('2026-10-20T12:00:00Z'), 100, 0.001),
        sessionAt('ses_b', Date.parse('2026-10-21T02:00:00Z'), 200, 0.002),
        sessionAt('ses_c', Date.parse('2026-10-21T03:00:00Z'), 300, 0.003),
      ],
      cursor: { next: null },
    },
  });
  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });
  // Fronteiras na meia-noite de São Paulo (UTC-3, sem horário de verão desde 2019):
  // assim os dois lados são dias cheios e o caso de borda do dia extra fica explícito.
  const result = await client.getOverview({
    from: Date.parse('2026-10-20T03:00:00Z'),
    to: Date.parse('2026-10-22T03:00:00Z'),
    timezone: TZ,
  });

  assert.ok(result.ok);
  const daily = result.overview.daily;
  assert.equal(daily.status, 'ok');

  if (daily.status === 'ok') {
    const byDate = new Map(daily.data.points.map((point) => [point.date, point]));
    assert.equal(daily.data.points.length, 2, 'esperava 20 e 21');
    assert.equal(byDate.get('2026-10-20')?.steps, 10);
    // ses_b é 02:00 UTC de 21/10, ou seja 23:00 de 20/10 em São Paulo: cai no dia 20.
    assert.equal(byDate.get('2026-10-20')?.sessionsStarted, 2);
    assert.equal(byDate.get('2026-10-20')?.tokens?.input, 300);
    assert.equal(byDate.get('2026-10-21')?.sessionsStarted, 1);
    assert.equal(byDate.get('2026-10-21')?.tokens?.input, 300);
  }
  pass('série diária', 'fronteira de fuso movendo sessão para o dia anterior');
}

// 6. Entrada inválida.
{
  const client = createOverview({ fetchRoute: fakeFetcher().fetcher, now: () => NOW });

  const badPreset = await client.getOverview({ preset: 'ontem' });
  assert.ok(!badPreset.ok, 'preset inválido passou');

  const inverted = await client.getOverview({ from: NOW, to: NOW - DAY });
  assert.ok(!inverted.ok, 'intervalo invertido passou');

  const badZone = await client.getOverview({ preset: '7d', timezone: 'Not/AZone' });
  assert.ok(!badZone.ok, 'fuso inválido passou');

  pass('entrada inválida', 'preset, intervalo e fuso recusados antes do CLI');
}

// 7. "Tudo" não gera série de 20 mil pontos.
{
  const { fetcher } = fakeFetcher({
    '/api/session': {
      data: [sessionAt('ses_a', Date.parse('2026-10-20T12:00:00Z'), 10, 0)],
      cursor: { next: null },
    },
  });
  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });
  const result = await client.getOverview({ preset: 'all', timezone: TZ });

  assert.ok(result.ok);
  const daily = result.overview.daily;
  if (daily.status === 'ok') {
    assert.ok(daily.data.points.length <= 2, `série de tudo com ${daily.data.points.length} pontos`);
  }
  pass('período tudo', 'série limitada ao intervalo com dado');
}

// 8. Título de sessão com caminho ou e-mail não sai do servidor.
{
  const long = 'a'.repeat(120);
  const { fetcher } = fakeFetcher({
    '/api/session': {
      data: [
        sessionAt('ses_ok', NOW - DAY, 10, 0),
        sessionAt('ses_path', NOW - DAY, 10, 0),
        sessionAt('ses_email', NOW - DAY, 10, 0),
        sessionAt('ses_long', NOW - DAY, 10, 0),
      ].map((session, index) => ({
        ...session,
        title: [
          'Corrige o login do painel',
          'Abrir D:\\projetos\\ocm\\src\\App.tsx',
          'falar com roger@example.com sobre o build',
          long,
        ][index],
      })),
      cursor: { next: null },
    },
  });

  const client = createOverview({ fetchRoute: fetcher, now: () => NOW });
  const result = await client.getOverview({ preset: '7d', timezone: TZ });

  assert.ok(result.ok);
  const sessions = result.overview.sessions;
  assert.equal(sessions.status, 'ok');

  if (sessions.status === 'ok') {
    const byId = new Map(sessions.data.items.map((item) => [item.id, item.title]));
    assert.equal(byId.get('ses_ok'), 'Corrige o login do painel', 'título comum deveria ficar');
    assert.equal(byId.get('ses_path'), undefined, 'título com caminho deveria sumir');
    assert.equal(byId.get('ses_email'), undefined, 'título com e-mail deveria sumir');
    assert.ok((byId.get('ses_long') ?? '').length <= 80, 'título longo deveria encurtar');

    const serialized = JSON.stringify(result.overview);
    assert.ok(!serialized.includes('projetos\\\\ocm'), 'caminho vazou no payload');
    assert.ok(!serialized.includes('roger@example.com'), 'e-mail vazou no payload');
  }

  pass('título sensível', 'caminho e e-mail omitidos, título comum preservado');
}

console.log(`\n${checks} verificações passaram`);
