const NUMBER = new Intl.NumberFormat('pt-BR');

const COMPACT = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const COST = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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

export function formatDateTime(epoch: number): string {
  return DATE_TIME.format(new Date(epoch));
}

/** Latência: ms abaixo de um segundo, segundos acima. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${formatNumber(Math.round(ms))} ms`;
  return `${DECIMAL.format(ms / 1000)} s`;
}

export function formatPercent(ratio: number): string {
  return PERCENT.format(ratio);
}

/** Identificador curto para eixo de gráfico. */
export function shorten(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function modelLabel(model: { id: string; variant?: string }): string {
  return model.variant ? `${model.id} · ${model.variant}` : model.id;
}
