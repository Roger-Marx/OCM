/**
 * Verificação de comportamento da fase 3: período, pausa, retomada, atualização
 * manual e resposta atrasada. Roda em DOM simulado, sem navegador:
 *
 *   node scripts/check-refresh.ts
 *
 * O que não é verificado aqui: aparência. Isso é olho, não script.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
});

const scope = globalThis as unknown as Record<string, unknown>;
scope.window = dom.window;
scope.document = dom.window.document;
scope.HTMLElement = dom.window.HTMLElement;
scope.Node = dom.window.Node;
scope.Event = dom.window.Event;
scope.IS_REACT_ACT_ENVIRONMENT = true;

try {
  // Node 24 expõe `navigator` como getter; redefinir é o único jeito de apontar
  // para o do jsdom.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
} catch {
  // Sem navigator o React ainda renderiza; só eventos sintéticos dependeriam dele.
}

type TimerCallback = () => void;

const timers = new Map<number, TimerCallback>();
let nextTimer = 1;

dom.window.setInterval = ((callback: TimerCallback) => {
  const id = nextTimer++;
  timers.set(id, callback);
  return id;
}) as typeof dom.window.setInterval;

dom.window.clearInterval = ((id: number) => {
  timers.delete(id);
}) as typeof dom.window.clearInterval;

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

interface Deferred {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
}

function defer(): Deferred {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const requested: string[] = [];
const opened: Array<{ url: string; signal: AbortSignal | null }> = [];

type Handler = (url: URL) => Promise<unknown>;
let deferredResponse: Deferred | null = null;

function fakeOverview(preset: string): unknown {
  return {
    requestedAt: Date.now(),
    period: { preset, from: 0, to: Date.now(), timezone: 'America/Sao_Paulo' },
    stats: { status: 'ok', data: { sessions: 56, steps: 900 } },
    daily: { status: 'ok', data: { points: [], coversWholePeriod: true } },
    sessions: { status: 'ok', data: { items: [], total: 56, complete: true } },
    agents: { status: 'ok', data: { total: 4, items: [] } },
    active: { status: 'ok', data: { total: 0 } },
    service: { status: 'ok', data: { version: '0.0.0', pid: 1, persistentPty: null } },
    location: { status: 'ok', data: { display: '~' } },
  };
}

let handler: Handler = async (url) => fakeOverview(url.searchParams.get('preset') ?? '?');

scope.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  requested.push(url.pathname + url.search);
  opened.push({ url: String(input), signal: init?.signal ?? null });

  const body = await handler(url);
  return { ok: true, status: 200, json: async () => body };
}) as typeof fetch;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { useOverview } = await import('../src/client/useOverview.ts');
type Controller = ReturnType<typeof useOverview>;

let current: Controller | null = null;

function Probe() {
  current = useOverview();
  return null;
}

const container = dom.window.document.getElementById('root');
if (!container) fail('montagem', 'container #root ausente');

const root = createRoot(container);

async function flush(): Promise<void> {
  await React.act(async () => {});
}

await React.act(async () => {
  root.render(React.createElement(Probe));
});

const hook = () => {
  if (!current) fail('montagem', 'hook não montou');
  return current as Controller;
};

expect(hook().phase === 'ready', 'carga inicial', `fase ${hook().phase}`);
expect(requested.length === 1, 'carga inicial', `${requested.length} chamadas`);
expect(requested[0]?.includes('preset=7d') === true, 'carga inicial', requested[0] ?? 'sem url');
expect(requested[0]?.includes('timezone=') === true, 'carga inicial', 'fuso não enviado');
expect(timers.size === 1, 'relógio', `${timers.size} temporizadores ativos`);
pass('carga inicial', '7 dias, fuso enviado, um relógio de 30 s');

await React.act(async () => {
  hook().togglePause();
});

expect(timers.size === 0, 'pausa', `${timers.size} temporizadores ativos`);
pass('pausa', 'relógio desligado');

const beforeManual = requested.length;
await React.act(async () => {
  hook().refresh();
});
await flush();

expect(requested.length === beforeManual + 1, 'manual pausado', `${requested.length} chamadas`);
pass('atualização manual com pausa', 'continua chamando');

await React.act(async () => {
  hook().togglePause();
});
await flush();

expect(requested.length === beforeManual + 2, 'retomada', `${requested.length} chamadas`);
expect(timers.size === 1, 'retomada', `${timers.size} temporizadores ativos`);
pass('retomada', 'chama na hora e religa o relógio');

const tick = [...timers.values()][0];
const beforeTick = requested.length;
await React.act(async () => {
  tick?.();
  await Promise.resolve();
});
await flush();

expect(requested.length === beforeTick + 1, 'relógio', `${requested.length} chamadas`);
pass('relógio de 30 s', 'cada disparo busca de novo');

await React.act(async () => {
  hook().setPeriod('1d');
});
await flush();

const lastUrl = requested[requested.length - 1] ?? '';
expect(lastUrl.includes('preset=1d'), 'troca de período', lastUrl);
expect(hook().data?.period.preset === '1d', 'troca de período', 'dado do período errado');
pass('troca de período', 'refaz a consulta com o período novo');

// Resposta atrasada: '30d' fica pendente, '90d' responde antes. A atrasada não
// pode sobrescrever a atual.
deferredResponse = defer();
handler = async () => deferredResponse?.promise ?? fakeOverview('30d');

await React.act(async () => {
  hook().setPeriod('30d');
});

handler = async (url) => fakeOverview(url.searchParams.get('preset') ?? '?');

await React.act(async () => {
  hook().setPeriod('90d');
});
await flush();

expect(hook().data?.period.preset === '90d', 'resposta atrasada', 'período atual perdido');

await React.act(async () => {
  deferredResponse?.resolve(fakeOverview('30d'));
  await Promise.resolve();
});
await flush();

expect(hook().data?.period.preset === '90d', 'resposta atrasada', 'resposta velha sobrescreveu a atual');
expect(opened.at(-2)?.signal?.aborted === true, 'resposta atrasada', 'requisição anterior não foi abortada');
pass('resposta atrasada', 'abortada e descartada pelo número de sequência');

const keptData = hook().data;
handler = async () => {
  throw new Error('rede caiu');
};

await React.act(async () => {
  hook().refresh();
});
await flush();

expect(hook().error !== null, 'falha de rede', 'erro não propagado');
expect(hook().data !== null, 'falha de rede', 'último dado bom foi apagado');
expect(hook().data === keptData, 'falha de rede', 'dado mudou sem resposta');
expect(!hook().error?.includes('rede caiu'), 'falha de rede', 'detalhe cru vazou para a interface');
expect(hook().phase === 'error', 'falha de rede', `fase ${hook().phase} com dados velhos na tela`);
pass('falha de rede', 'erro visível, fase de falha, último dado bom preservado');

handler = async (url) => fakeOverview(url.searchParams.get('preset') ?? '?');

await React.act(async () => {
  hook().refresh();
});
await flush();

expect(hook().error === null, 'recuperação', 'erro não foi limpo');
expect(hook().phase === 'ready', 'recuperação', `fase ${hook().phase}`);
pass('recuperação', 'erro limpo e fase volta a pronto');

await React.act(async () => {
  root.unmount();
});

expect(timers.size === 0, 'desmontagem', `${timers.size} temporizadores ativos`);
pass('desmontagem', 'relógio cancelado');

console.log(`\n${checks} verificações passaram`);

export {};
