const NUMBER = new Intl.NumberFormat('pt-BR');

const COMPACT = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const COST = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** Para eixo e rótulo apertado: 12,3 mil. Nunca para valor exato de custo. */
export function formatCompact(value: number): string {
  return COMPACT.format(value);
}

/** Decisão registrada: custo sempre com 4 casas, mesmo quando é zero. */
export function formatCost(value: number): string {
  return `US$ ${COST.format(value)}`;
}

export function formatCostValue(value: number): string {
  return COST.format(value);
}

/**
 * Data `YYYY-MM-DD` formatada por corte de string, não por `Date`. `new Date('2026-10-22')`
 * é meia-noite UTC e, em UTC-3, mostraria o dia anterior.
 */
export function formatDayShort(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function formatDayFull(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
