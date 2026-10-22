/**
 * Verificação do texto do período (fase 6):
 *
 *   node scripts/check-reading.ts
 *
 * A regra que importa: nenhuma frase pode existir sem o número que a sustenta.
 */
import { buildReading } from '../src/client/reading.ts';
import type { OverviewResponse } from '../src/api/overview.ts';

let checks = 0;

function pass(label: string, detail = ''): void {
  checks += 1;
  console.log(`ok   ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail: string): never {
  console.error(`FALHA ${label} — ${detail}`);
  process.exit(1);
}

function expect(condition: boolean, label: string, detail: string): void {
  if (!condition) fail(label, detail);
}

const tokens = (input = 10) => ({
  input,
  output: 5,
  reasoning: 1,
  cache: { read: 2, write: 1 },
});

const day = (date: string, steps: number | null) => ({
  date,
  steps,
  sessionsStarted: 1,
  tokens: tokens(),
  cost: 0.0001,
});

interface Base {
  steps?: number;
  subagents?: number;
  models?: unknown[];
  tools?: unknown;
  points?: unknown[];
  coversWholePeriod?: boolean;
  active?: number;
  statsStatus?: 'ok' | 'error';
  dailyStatus?: 'ok' | 'error';
  activeStatus?: 'ok' | 'error';
}

function make(base: Base = {}): OverviewResponse {
  const {
    steps = 900,
    subagents = 6,
    models = [
      {
        model: { id: 'modelo-a', providerID: 'prov' },
        steps: 100,
        tokens: tokens(),
        cost: 0.0003,
      },
      {
        model: { id: 'modelo-b', providerID: 'prov' },
        steps: 50,
        tokens: tokens(),
        cost: 0.0001,
      },
    ],
    tools = {
      mode: 'detail',
      totals: { calls: 4, succeeded: 3, failed: 1, unfinished: 0 },
      usage: [
        { name: 'bash', calls: 3, succeeded: 2, failed: 1, unfinished: 0 },
        { name: 'read', calls: 1, succeeded: 1, failed: 0, unfinished: 0 },
      ],
    },
    points = [day('2026-10-19', 10), day('2026-10-20', 10), day('2026-10-21', 20), day('2026-10-22', 20)],
    coversWholePeriod = true,
    active = 0,
    statsStatus = 'ok',
    dailyStatus = 'ok',
    activeStatus = 'ok',
  } = base;

  return {
    requestedAt: Date.now(),
    period: { preset: '7d', from: 0, to: Date.now(), timezone: 'America/Sao_Paulo' },
    stats:
      statsStatus === 'ok'
        ? {
            status: 'ok',
            data: {
              range: { from: 0, to: 1 },
              sessions: 56,
              subagents,
              prompts: 120,
              steps,
              tokens: tokens(),
              cost: 0,
              tools,
              activeDays: 4,
              streak: 2,
              activity: [],
              models,
            },
          }
        : { status: 'error', error: { kind: 'cli-error', message: 'Serviço fora.' } },
    daily:
      dailyStatus === 'ok'
        ? { status: 'ok', data: { points, coversWholePeriod } }
        : { status: 'error', error: { kind: 'cli-error', message: 'Serviço fora.' } },
    sessions: { status: 'ok', data: { items: [], total: 0, complete: true } },
    agents: { status: 'ok', data: { total: 0, items: [] } },
    active:
      activeStatus === 'ok'
        ? { status: 'ok', data: { total: active } }
        : { status: 'error', error: { kind: 'cli-error', message: 'Serviço fora.' } },
    service: { status: 'ok', data: { version: '2.0.0', pid: 1, persistentPty: null } },
    location: { status: 'ok', data: { display: '~' } },
  } as unknown as OverviewResponse;
}

// 1. Texto completo.
{
  const lines = buildReading(make({ active: 1 }));

  expect(lines[0]?.includes('56 sessões') === true, 'volume', `primeira frase: ${lines[0]}`);
  expect(lines[0]?.includes('6 delas subagentes') === true, 'volume', 'subagentes ausentes');
  expect(lines[0]?.includes('900 passos') === true, 'volume', 'passos ausentes');
  expect(lines.some((line) => line.includes('subiram')), 'tendência', 'tendência de alta ausente');
  expect(lines.some((line) => line.includes('21/10/2026')), 'dia mais ativo', 'dia ausente');
  expect(
    lines.some((line) => line.includes('modelo-a') && line.includes('75,0%')),
    'custo',
    'concentração ausente',
  );
  expect(
    lines.some((line) => line.includes('1 de 4 chamadas') && line.includes('25,0%')),
    'falhas',
    'taxa ausente',
  );
  expect(lines.some((line) => line.includes('1 sessão em execução agora')), 'ativas', 'ausente');
  pass('texto completo', `${lines.length} frases`);
}

// 2. Queda em vez de alta.
{
  const lines = buildReading(
    make({
      points: [
        day('2026-10-19', 20),
        day('2026-10-20', 20),
        day('2026-10-21', 10),
        day('2026-10-22', 10),
      ],
    }),
  );

  expect(lines.some((line) => line.includes('caíram 50,0%')), 'tendência', lines.join(' | '));
  pass('tendência de baixa', 'caíram 50,0%');
}

// 3. Período diferente muda o texto.
{
  const first = buildReading(make()).join(' ');
  const second = buildReading(make({ steps: 1200, subagents: 0 })).join(' ');

  expect(first !== second, 'texto por período', 'texto igual com números diferentes');
  expect(second.includes('1.200 passos'), 'texto por período', 'número novo ausente');
  expect(!second.includes('delas subagentes'), 'texto por período', 'cláusula sem subagente');
  pass('texto por período', 'muda com os números');
}

// 4. Sem fonte, sem frase.
{
  const lines = buildReading(make({ statsStatus: 'error', dailyStatus: 'error', activeStatus: 'error' }));
  expect(lines.length === 0, 'sem fonte', `frases inventadas: ${lines.join(' | ')}`);
  pass('sem fonte', 'nenhuma frase');
}

// 5. Custo zero não vira frase de concentração.
{
  const lines = buildReading(
    make({
      models: [
        { model: { id: 'modelo-a', providerID: 'prov' }, steps: 10, tokens: tokens(), cost: 0 },
      ],
    }),
  );

  expect(!lines.some((line) => line.includes('concentra')), 'custo zero', 'inventou concentração');
  pass('custo zero', 'sem frase de custo');
}

// 6. Série curta não vira tendência.
{
  const lines = buildReading(
    make({ points: [day('2026-10-21', 10), day('2026-10-22', 40)] }),
  );

  expect(!lines.some((line) => line.includes('metade do período')), 'série curta', 'inventou tendência');
  pass('série curta', 'sem tendência com dois dias');
}

// 7. Cobertura incompleta é avisada.
{
  const lines = buildReading(make({ coversWholePeriod: false }));
  expect(
    lines.some((line) => line.includes('não cobriu todo o período')),
    'cobertura',
    'aviso ausente',
  );
  pass('cobertura parcial', 'aviso presente');
}

// 8. Falha zero tem frase própria, não 0%.
{
  const lines = buildReading(
    make({
      tools: {
        mode: 'detail',
        totals: { calls: 7, succeeded: 7, failed: 0, unfinished: 0 },
        usage: [{ name: 'bash', calls: 7, succeeded: 7, failed: 0, unfinished: 0 }],
      },
    }),
  );

  expect(
    lines.some((line) => line.includes('Nenhuma das 7 chamadas')),
    'zero falhas',
    lines.join(' | '),
  );
  pass('zero falhas', 'frase afirmativa em vez de 0%');
}

console.log(`\n${checks} verificações passaram`);

export {};
