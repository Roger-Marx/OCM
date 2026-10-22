import type { ActivityDay, EpochMs, IsoDate, SessionInfo, TokenUsage, Usd } from '../../contract/types.ts';
import type { DailyPoint } from '../../api/overview.ts';

/**
 * Série diária derivada. Cada campo é `null` quando a fonte daquele número não
 * respondeu — a interface desenha lacuna, não zero. Zero é um dado; lacuna é ausência.
 */
export type { DailyPoint } from '../../api/overview.ts';


const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const created = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formatters.set(timeZone, created);
  return created;
}

/** Dia do evento no fuso pedido, no formato `YYYY-MM-DD`. */
export function dayKey(epoch: EpochMs, timeZone: string): IsoDate {
  const parts = formatterFor(timeZone).formatToParts(new Date(epoch));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function addDays(date: IsoDate, amount: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Dias entre duas datas, inclusive nas pontas. Aritmética em UTC de propósito:
 * somar 24 h num fuso com horário de verão pularia ou repetiria um dia.
 */
export function daysBetween(first: IsoDate, last: IsoDate, guard = 4000): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = first;

  while (cursor <= last && out.length < guard) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return out;
}

const emptyTokens = (): TokenUsage => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
});

function addTokens(into: TokenUsage, add: TokenUsage): void {
  into.input += add.input;
  into.output += add.output;
  into.reasoning += add.reasoning;
  into.cache.read += add.cache.read;
  into.cache.write += add.cache.write;
}

export interface DailyInput {
  /** Dias que a série deve cobrir, em ordem. */
  dates: IsoDate[];
  /** `null` quando `stats` não respondeu. */
  activity: ActivityDay[] | null;
  /** `null` quando a listagem de sessões não respondeu. */
  sessions: SessionInfo[] | null;
  timeZone: string;
}

export function buildDaily({ dates, activity, sessions, timeZone }: DailyInput): DailyPoint[] {
  const stepsByDay = new Map<IsoDate, number>();
  for (const day of activity ?? []) stepsByDay.set(day.date, day.steps);

  const sessionsByDay = new Map<IsoDate, { count: number; tokens: TokenUsage; cost: Usd }>();
  for (const session of sessions ?? []) {
    const key = dayKey(session.time.created, timeZone);
    const bucket = sessionsByDay.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.cost += session.cost;
      addTokens(bucket.tokens, session.tokens);
    } else {
      sessionsByDay.set(key, {
        count: 1,
        tokens: { ...session.tokens, cache: { ...session.tokens.cache } },
        cost: session.cost,
      });
    }
  }

  return dates.map((date) => {
    const bucket = sessionsByDay.get(date);
    return {
      date,
      steps: activity === null ? null : stepsByDay.get(date) ?? 0,
      sessionsStarted: sessions === null ? null : bucket?.count ?? 0,
      tokens: sessions === null ? null : bucket?.tokens ?? emptyTokens(),
      cost: sessions === null ? null : bucket?.cost ?? 0,
    };
  });
}

/** Primeiro e último dia com dado observado, para a faixa "tudo". */
export function observedSpan(
  activity: ActivityDay[] | null,
  sessions: SessionInfo[] | null,
  timeZone: string,
): { first: IsoDate; last: IsoDate } | null {
  const days: IsoDate[] = [];

  for (const day of activity ?? []) days.push(day.date);
  for (const session of sessions ?? []) days.push(dayKey(session.time.created, timeZone));

  if (days.length === 0) return null;

  days.sort();
  return { first: days[0] as IsoDate, last: days[days.length - 1] as IsoDate };
}
