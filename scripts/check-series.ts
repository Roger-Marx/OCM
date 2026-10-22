/**
 * Verificação das séries da fase 4, sem DOM:
 *
 *   node scripts/check-series.ts
 *
 * Regra central: `null` é lacuna. Zero é dado. Nenhuma transformação pode trocar
 * um pelo outro.
 */
import {
  toActivitySeries,
  toCumulativeCost,
  toTokenSeries,
} from '../src/client/series.ts';
import type { DailyPoint } from '../src/api/overview.ts';

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

const tokens = (input: number, output: number, reasoning: number, read: number, write: number) => ({
  input,
  output,
  reasoning,
  cache: { read, write },
});

const day = (date: string, overrides: Partial<DailyPoint> = {}): DailyPoint => ({
  date,
  steps: 10,
  sessionsStarted: 1,
  tokens: tokens(100, 50, 5, 20, 2),
  cost: 0.001,
  ...overrides,
});

const empty = toActivitySeries([]);
expect(empty.length === 0, 'série vazia', 'atividade devolveu linha');
expect(toTokenSeries([]).length === 0, 'série vazia', 'tokens devolveu linha');
expect(toCumulativeCost([]).length === 0, 'série vazia', 'custo devolveu linha');
pass('série vazia', 'nenhuma linha inventada');

const gap: DailyPoint[] = [
  day('2026-10-20'),
  day('2026-10-21', { steps: null, sessionsStarted: null, tokens: null, cost: null }),
  day('2026-10-22', { steps: 0, sessionsStarted: 0, tokens: tokens(0, 0, 0, 0, 0), cost: 0 }),
];

const activity = toActivitySeries(gap);
expect(activity[1]?.passos === null, 'lacuna', 'passos virou zero');
expect(activity[1]?.sessoes === null, 'lacuna', 'sessões virou zero');
expect(activity[2]?.passos === 0, 'zero é dado', 'zero virou lacuna');
pass('lacuna e zero', 'passos e sessões distinguem ausência de zero');

const tokenRows = toTokenSeries(gap);
expect(tokenRows[1]?.entrada === null, 'lacuna', 'tokens virou zero');
expect(tokenRows[2]?.cache === 0, 'cache', 'cache de zero não saiu como zero');
expect(tokenRows[0]?.cache === 22, 'cache', 'cache não somou leitura e escrita');
pass('tokens por tipo', 'cache soma leitura e escrita; lacuna continua lacuna');

const cost = toCumulativeCost(gap);
expect(cost[0]?.acumulado === 0.001, 'acumulado', 'primeiro dia errado');
expect(cost[1]?.acumulado === null, 'acumulado', 'acumulou por cima de lacuna');
expect(cost[2]?.acumulado === null, 'acumulado', 'retomou depois da lacuna');
pass('custo acumulado', 'buraco interrompe a série até o fim');

const three = toCumulativeCost([day('2026-10-20'), day('2026-10-21'), day('2026-10-22')]);
const last = three[2]?.acumulado ?? 0;
expect(Math.abs(last - 0.003) < 1e-9, 'acumulado', `soma ${last}`);
pass('custo acumulado', 'soma os três dias');

console.log(`\n${checks} verificações passaram`);

export {};
