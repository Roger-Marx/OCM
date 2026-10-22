import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverviewError, OverviewResponse, PeriodPreset } from '../api/overview.ts';

/** O PRD fixa 30 s. Exportado para o teste não repetir o número. */
export const AUTO_REFRESH_MS = 30_000;

export type OverviewPhase = 'loading' | 'refreshing' | 'ready' | 'error';

interface LoadedOverview {
  period: PeriodPreset;
  data: OverviewResponse;
  at: number;
}

export interface OverviewController {
  period: PeriodPreset;
  setPeriod: (period: PeriodPreset) => void;
  paused: boolean;
  togglePause: () => void;
  refresh: () => void;
  /** Só existe quando os dados são do período selecionado. */
  data: OverviewResponse | null;
  phase: OverviewPhase;
  /** Mensagem própria; o detalhe do CLI nunca chega aqui. */
  error: string | null;
  lastUpdated: number | null;
}

function readErrorMessage(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || !('error' in body)) return null;
  const error = (body as { error?: OverviewError }).error;
  if (!error || typeof error.message !== 'string') return null;

  const message = error.message.trim();
  return message.length > 0 ? message : null;
}

/**
 * Estado de leitura do overview.
 *
 * Regras que valem a pena saber antes de mexer:
 *
 * - Refresh do mesmo período mantém os números na tela (`refreshing`); trocar de
 *   período não mostra dado do período anterior, porque número de 30 dias
 *   rotulado como 1 dia é mentira.
 * - Uma resposta antiga que chega atrasada é descartada pelo número de sequência.
 *   Trocar de período rápido não deixa a resposta anterior sobrescrever a atual.
 * - Falha vira estado do painel: o último dado bom do mesmo período continua
 *   visível e o erro aparece como aviso.
 * - Pausar só desliga o relógio de 30 s. Atualizar à mão continua funcionando.
 */
export function useOverview(initialPeriod: PeriodPreset = '7d'): OverviewController {
  const [period, setPeriod] = useState<PeriodPreset>(initialPeriod);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState<LoadedOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      inFlight.current?.abort();
    };
  }, []);

  const fetchNow = useCallback(async (target: PeriodPreset) => {
    inFlight.current?.abort();

    const controller = new AbortController();
    inFlight.current = controller;
    const seq = ++sequence.current;

    setBusy(true);

    const url = new URL('/oc-api/overview', window.location.origin);
    url.searchParams.set('preset', target);

    // O fuso sai do navegador, não do servidor: a série diária precisa cortar o
    // dia no relógio de quem está olhando.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) url.searchParams.set('timezone', timezone);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      const body: unknown = await response.json().catch(() => null);

      if (!alive.current || seq !== sequence.current) return;

      if (!response.ok) {
        setError(readErrorMessage(body) ?? `O endpoint local respondeu ${response.status}.`);
        return;
      }

      setLoaded({ period: target, data: body as OverviewResponse, at: Date.now() });
      setError(null);
    } catch {
      if (!alive.current || seq !== sequence.current) return;
      if (controller.signal.aborted) return;
      setError('Não consegui falar com o endpoint local. Verifique se o servidor está rodando.');
    } finally {
      if (alive.current && seq === sequence.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void fetchNow(period);
  }, [period, fetchNow]);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      void fetchNow(period);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [paused, period, fetchNow]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) void fetchNow(period);
    wasPaused.current = paused;
  }, [paused, period, fetchNow]);

  const refresh = useCallback(() => {
    void fetchNow(period);
  }, [fetchNow, period]);

  const togglePause = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  const data = loaded && loaded.period === period ? loaded.data : null;

  // Falha na última tentativa vence "pronto": o TopBar não pode dizer que está
  // atualizado enquanto o aviso acima diz que a atualização falhou.
  const phase: OverviewPhase = busy
    ? data
      ? 'refreshing'
      : 'loading'
    : error
      ? 'error'
      : data
        ? 'ready'
        : 'loading';

  return {
    period,
    setPeriod,
    paused,
    togglePause,
    refresh,
    data,
    phase,
    error,
    lastUpdated: data ? (loaded?.at ?? null) : null,
  };
}
