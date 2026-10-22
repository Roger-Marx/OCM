import type { DailyPoint } from '../api/overview.ts';

/**
 * Transformações da série diária para o formato que o Recharts consome.
 *
 * Ficam fora dos componentes de propósito: `null` é lacuna, não zero, e essa
 * regra precisa de teste sem DOM.
 */

export interface ActivityRow {
  date: string;
  passos: number | null;
  sessoes: number | null;
}

export function toActivitySeries(points: DailyPoint[]): ActivityRow[] {
  return points.map((point) => ({
    date: point.date,
    passos: point.steps,
    sessoes: point.sessionsStarted,
  }));
}

export interface TokenRow {
  date: string;
  entrada: number | null;
  saida: number | null;
  raciocinio: number | null;
  cache: number | null;
}

export function toTokenSeries(points: DailyPoint[]): TokenRow[] {
  return points.map((point) => ({
    date: point.date,
    entrada: point.tokens?.input ?? null,
    saida: point.tokens?.output ?? null,
    raciocinio: point.tokens?.reasoning ?? null,
    cache: point.tokens ? point.tokens.cache.read + point.tokens.cache.write : null,
  }));
}

export interface CostRow {
  date: string;
  acumulado: number | null;
}

/**
 * Acumulado do período. Depois do primeiro dia sem custo conhecido a série fica
 * `null` até o fim: acumular por cima de um buraco daria número menor como se
 * fosse total.
 */
export function toCumulativeCost(points: DailyPoint[]): CostRow[] {
  let running: number | null = 0;

  return points.map((point) => {
    if (point.cost === null) running = null;
    else if (running !== null) running += point.cost;

    return { date: point.date, acumulado: running };
  });
}
