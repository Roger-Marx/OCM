import type { EpochMs } from '../../contract/types.ts';
import { PRESETS, type Period, type PeriodPreset } from '../../api/overview.ts';
import { MAX_SERIES_DAYS } from './daily.ts';

export type { Period, PeriodPreset } from '../../api/overview.ts';

export interface PeriodError {
  field: 'preset' | 'from' | 'to' | 'timezone';
  message: string;
}

const DAY_MS = 86_400_000;
const PRESET_DAYS: Record<Exclude<PeriodPreset, 'all'>, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** Fuso do processo. O PRD manda o fuso junto, então o padrão é o da máquina. */
export function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function isPreset(value: string): value is PeriodPreset {
  return (PRESETS as readonly string[]).includes(value);
}

export interface PeriodInput {
  preset?: string;
  from?: EpochMs;
  to?: EpochMs;
  timezone?: string;
}

/**
 * `to` é exclusivo no dia, como o serviço trata. Para preset, a janela termina
 * agora, o que inclui o dia corrente.
 */
export function resolvePeriod(
  input: PeriodInput,
  now: EpochMs,
): { ok: true; period: Period } | { ok: false; error: PeriodError } {
  const presetRaw = input.preset ?? '30d';
  if (!isPreset(presetRaw)) {
    return { ok: false, error: { field: 'preset', message: 'Período desconhecido.' } };
  }

  const timezone = input.timezone ?? defaultTimezone();
  if (!isValidTimezone(timezone)) {
    return { ok: false, error: { field: 'timezone', message: 'Fuso horário desconhecido.' } };
  }

  if (presetRaw === 'all') {
    return { ok: true, period: { preset: 'all', from: 0, to: now, timezone } };
  }

  if (input.from !== undefined || input.to !== undefined) {
    const from = input.from;
    const to = input.to;

    if (typeof from !== 'number' || !Number.isFinite(from) || from < 0) {
      return { ok: false, error: { field: 'from', message: 'Início do período inválido.' } };
    }
    if (typeof to !== 'number' || !Number.isFinite(to)) {
      return { ok: false, error: { field: 'to', message: 'Fim do período inválido.' } };
    }
    if (from >= to) {
      return { ok: false, error: { field: 'from', message: 'O início precisa ser anterior ao fim.' } };
    }
    if ((to - from) / DAY_MS > MAX_SERIES_DAYS) {
      return {
        ok: false,
        error: {
          field: 'from',
          message: `O intervalo passa de ${MAX_SERIES_DAYS.toLocaleString('pt-BR')} dias. Use um período menor.`,
        },
      };
    }

    return { ok: true, period: { preset: presetRaw, from, to, timezone } };
  }

  const days = PRESET_DAYS[presetRaw];
  return { ok: true, period: { preset: presetRaw, from: now - days * DAY_MS, to: now, timezone } };
}
