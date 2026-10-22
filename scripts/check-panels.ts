/**
 * Verificação de renderização da fase 4: cada painel entrega dado, estado vazio ou
 * motivo de indisponibilidade — e nenhum gráfico derruba a página.
 *
 *   node scripts/check-panels.ts
 *
 * Roda em jsdom. Não mede layout: mede conteúdo renderizado e ausência de exceção.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

const scope = globalThis as unknown as Record<string, unknown>;
scope.window = dom.window;
scope.document = dom.window.document;
scope.self = dom.window;
scope.HTMLElement = dom.window.HTMLElement;
scope.Node = dom.window.Node;
scope.Event = dom.window.Event;
scope.IS_REACT_ACT_ENVIRONMENT = true;
scope.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
scope.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
} catch {
  // Recharts não depende de navigator para desenhar o contêiner.
}

/**
 * Recharts mede o contêiner com ResizeObserver; em jsdom não há medida. O stub
 * entrega 800x240 na hora para o gráfico desenhar de verdade.
 */
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const entry = {
      target,
      contentRect: { width: 800, height: 240, top: 0, left: 0, right: 800, bottom: 240, x: 0, y: 0 },
      borderBoxSize: [{ inlineSize: 800, blockSize: 240 }],
      contentBoxSize: [{ inlineSize: 800, blockSize: 240 }],
      devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 240 }],
    } as unknown as ResizeObserverEntry;

    this.callback([entry], this as unknown as ResizeObserver);
  }

  unobserve(): void {}
  disconnect(): void {}
}
scope.ResizeObserver = ResizeObserverStub;

// jsdom não mede layout: todo elemento mede zero e o ResponsiveContainer desiste de
// desenhar. Uma medida fixa deixa o Recharts renderizar o SVG de verdade.
dom.window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    width: 800,
    height: 240,
    top: 0,
    left: 0,
    right: 800,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
};

// Recharts avisa a cada gráfico que o contêiner mede zero em jsdom. O aviso é
// esperado aqui e só polui a saída.
const warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (String(args[0]).includes('of chart should be greater than 0')) return;
  warn(...args);
};

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

function point(date: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    date,
    steps: 10,
    sessionsStarted: 1,
    tokens: { input: 100, output: 50, reasoning: 5, cache: { read: 20, write: 2 } },
    cost: 0.0006174,
    ...overrides,
  };
}

function overview(overrides: Record<string, unknown> = {}): unknown {
  return {
    requestedAt: Date.now(),
    period: { preset: '7d', from: 0, to: Date.now(), timezone: 'America/Sao_Paulo' },
    stats: {
      status: 'ok',
      data: {
        range: { from: 0, to: 1 },
        sessions: 56,
        subagents: 3,
        prompts: 120,
        steps: 900,
        tokens: { input: 1000, output: 500, reasoning: 50, cache: { read: 200, write: 20 } },
        cost: 0.0006,
        tools: {
          mode: 'detail',
          totals: { calls: 4, succeeded: 3, failed: 1, unfinished: 0 },
          usage: [
            { name: 'bash', calls: 4, succeeded: 3, failed: 1, unfinished: 0, durationP50: 1500 },
            { name: 'read', calls: 2, succeeded: 2, failed: 0, unfinished: 0, durationP50: 120 },
          ],
        },
        activeDays: 5,
        streak: 2,
        activity: [],
        models: [
          {
            model: { id: 'claude-sonnet-4-5', providerID: 'anthropic' },
            steps: 120,
            tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 1, write: 1 } },
            cost: 0.0004,
          },
        ],
      },
    },
    daily: {
      status: 'ok',
      data: { points: [point('2026-10-21'), point('2026-10-22')], coversWholePeriod: true },
    },
    sessions: {
      status: 'ok',
      data: {
        items: [
          {
            id: 'ses_1',
            agent: 'build',
            model: { id: 'claude-sonnet-4-5', providerID: 'anthropic' },
            cost: 0.0006,
            tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 1, write: 1 } },
            created: Date.parse('2026-10-22T16:00:00Z'),
            updated: Date.parse('2026-10-22T16:10:00Z'),
          },
          {
            id: 'ses_2',
            title: 'Corrige o login do painel',
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            created: Date.parse('2026-10-21T16:00:00Z'),
            updated: Date.parse('2026-10-21T16:10:00Z'),
          },
        ],
        total: 2,
        complete: true,
      },
    },
    agents: {
      status: 'ok',
      data: {
        total: 1,
        items: [{ id: 'build', name: 'build', mode: 'primary', hidden: false, steps: 12 }],
      },
    },
    active: { status: 'ok', data: { total: 0 } },
    service: { status: 'ok', data: { version: '0.0.0', pid: 1, persistentPty: null } },
    location: { status: 'ok', data: { display: '~' } },
    ...overrides,
  };
}

let response: unknown = overview();
const failWith: string | null = null;
scope.fetch = (async () => {
  if (failWith) throw new Error(failWith);
  return { ok: true, status: 200, json: async () => response };
}) as unknown as typeof fetch;

const React = await import('react');
const { createRoot } = await import('react-dom/client');

// Node remove tipos de .ts, mas não entende JSX. O Vite transforma e carrega o App
// como módulo SSR, sem abrir porta.
const { createServer } = await import('vite');
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const { App } = (await vite.ssrLoadModule('/src/App.tsx')) as {
  App: () => React.ReactElement;
};

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLElement | null = null;

function text(): string {
  return container?.textContent ?? '';
}

/** Após `mount()`, a árvore existe. O TypeScript não sabe disso; este acessor sabe. */
function mounted(): HTMLElement {
  if (!container) fail('montagem', 'árvore não montada');
  return container;
}

/**
 * Cada cenário monta uma árvore nova. O hook só busca no mount e na troca de
 * período, então reaproveitar a raiz mostraria o dado do cenário anterior.
 */
async function mount(): Promise<void> {
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);

  container = host;
  root = createRoot(host);

  await React.act(async () => {
    root?.render(React.createElement(App));
  });
  await React.act(async () => {});
}

async function unmount(): Promise<void> {
  await React.act(async () => {
    root?.unmount();
  });

  container?.remove();
  root = null;
  container = null;
}

await mount();

expect(text().includes('Tokens de entrada'), 'dados completos', 'cartões de KPI não renderizaram');
expect(text().includes('56'), 'dados completos', 'total de sessões ausente');
expect(text().includes('US$ 0,0006'), 'custo com 4 casas', 'custo não saiu com 0,0000');
expect(text().includes('Atividade'), 'dados completos', 'painel de atividade ausente');
expect(text().includes('Tokens por dia'), 'dados completos', 'painel de tokens ausente');
expect(text().includes('Custo acumulado'), 'dados completos', 'painel de custo ausente');
expect(
  text().includes('De onde vêm os números'),
  'nota de origem',
  'nota sobre a fonte da série ausente',
);
pass('dados completos', 'KPIs, três painéis e nota de origem');

expect(text().includes('1.000'), 'tokens formatados', 'agrupamento pt-BR ausente');
pass('formatação pt-BR', '1.000 com ponto de milhar e 0,0006 com vírgula');

const svgs = mounted().querySelectorAll('svg.recharts-surface').length;
const axes = mounted().querySelectorAll('.recharts-cartesian-axis').length;
expect(svgs >= 3, 'gráficos montados', `${svgs} svg`);
expect(axes >= 4, 'gráficos montados', `${axes} eixos`);
pass('gráficos montados', `${svgs} gráficos com eixos, sem exceção`);

expect(text().includes('claude-sonnet-4-5'), 'modelos', 'ranking não renderizou');
expect(text().includes('bash'), 'ferramentas', 'tabela não renderizou');
expect(text().includes('25,0%'), 'ferramentas', 'taxa de falha não saiu como 25,0%');
expect(text().includes('1,5 s'), 'ferramentas', 'p50 não saiu em segundos');
expect(text().includes('2 de 2 sessões no período'), 'sessões', 'rodapé de sessões errado');
expect(text().includes('Sem título'), 'sessões', 'título ausente não virou marcador');
expect(text().includes('Corrige o login do painel'), 'sessões', 'título comum não apareceu');
expect(text().includes('Leitura do período'), 'leitura', 'painel de leitura ausente');
expect(text().includes('56 sessões'), 'leitura', 'volume do período ausente');
expect(text().includes('900 passos'), 'leitura', 'passos do período ausentes');
expect(
  text().includes('Todo o custo do período veio de'),
  'leitura',
  'frase de custo ausente com um modelo só',
);
expect(text().includes('Serviço'), 'serviço', 'painel de serviço ausente');
expect(text().includes('0.0.0'), 'serviço', 'versão ausente');
expect(text().includes('PTY persistente'), 'serviço', 'linha de PTY ausente');
expect(text().includes('~'), 'serviço', 'diretório do serviço ausente');
expect(text().includes('a página atualiza a cada 30 s'), 'nota', 'ritmo de atualização ausente');
pass('tabelas, leitura e serviço', 'números, texto do período e estado do serviço');

response = overview({
  service: {
    status: 'error',
    error: { kind: 'cli-error', message: 'O CLI do OpenCode não respondeu.' },
  },
  location: {
    status: 'error',
    error: { kind: 'cli-error', message: 'O CLI do OpenCode não respondeu.' },
  },
  active: { status: 'error', error: { kind: 'cli-error', message: 'O CLI do OpenCode não respondeu.' } },
});

await unmount();
await mount();

expect(text().includes('indisponível'), 'serviço fora', 'estado indisponível ausente');
expect(
  text().includes('O CLI do OpenCode não respondeu.'),
  'serviço fora',
  'motivo do serviço ausente',
);
expect(text().includes('Leitura do período'), 'serviço fora', 'leitura sumiu junto com o serviço');
pass('serviço fora', 'estado e motivo no painel; leitura segue com os dados do período');

response = overview({
  stats: { status: 'error', error: { kind: 'cli-error', message: 'O serviço não respondeu.' } },
  daily: { status: 'error', error: { kind: 'cli-error', message: 'O serviço não respondeu.' } },
});

await unmount();
await mount();

const unavailable = (text().match(/Indisponível nesta leitura/g) ?? []).length;
expect(unavailable >= 6, 'degradação', `${unavailable} painéis indisponíveis`);
expect(text().includes('O serviço não respondeu.'), 'degradação', 'motivo não exibido');
pass('degradação', 'seis painéis com motivo; sessões e agentes seguem com dado');

response = overview({
  daily: { status: 'ok', data: { points: [], coversWholePeriod: true } },
});

await unmount();
await mount();

const empties = (text().match(/Nenhum dia no período selecionado\./g) ?? []).length;
expect(empties === 3, 'série vazia', `${empties} painéis com estado vazio`);
pass('série vazia', 'três painéis em estado vazio, sem quebrar');

response = overview({
  daily: {
    status: 'ok',
    data: {
      points: [point('2026-10-21', { steps: null }), point('2026-10-22', { steps: null })],
      coversWholePeriod: false,
    },
  },
});

await unmount();
await mount();

expect(
  text().includes('Série parcial'),
  'série parcial',
  'aviso de cobertura incompleta ausente',
);
pass('série parcial', 'cobertura incompleta avisada no rodapé');

/**
 * Degradação rota por rota: cada cenário derruba uma fonte só e confere o painel
 * que depende dela. O resto da página tem que seguir de pé.
 */
function unavailableCount(value: string): number {
  return (value.match(/Indisponível nesta leitura/g) ?? []).length;
}

function errorPart(): unknown {
  return {
    status: 'error',
    error: { kind: 'cli-error', message: 'Fonte fora do ar neste teste.' },
  };
}

const routeScenarios: Array<{
  part: string;
  overrides: Record<string, unknown>;
  verify: (value: string) => void;
}> = [
  {
    part: 'stats',
    overrides: { stats: errorPart() },
    verify: (value) => {
      expect(
        unavailableCount(value) === 3,
        'rota stats',
        `${unavailableCount(value)} painéis fora (esperava KPI, modelos e ferramentas)`,
      );
      expect(value.includes('Corrige o login do painel'), 'rota stats', 'sessões sumiram junto');
    },
  },
  {
    part: 'daily',
    overrides: { daily: errorPart() },
    verify: (value) => {
      expect(
        unavailableCount(value) === 3,
        'rota daily',
        `${unavailableCount(value)} painéis fora (esperava atividade, tokens e custo)`,
      );
      expect(value.includes('Tokens de entrada'), 'rota daily', 'KPIs sumiram junto');
      expect(value.includes('Leitura do período'), 'rota daily', 'leitura sumiu junto');
    },
  },
  {
    part: 'sessions',
    overrides: { sessions: errorPart() },
    verify: (value) => {
      expect(unavailableCount(value) === 1, 'rota sessions', `${unavailableCount(value)} painéis fora`);
      expect(value.includes('Sessões recentes'), 'rota sessions', 'painel não apareceu');
      expect(value.includes('claude-sonnet-4-5'), 'rota sessions', 'modelos sumiram junto');
    },
  },
  {
    part: 'agents',
    overrides: { agents: errorPart() },
    verify: (value) => {
      expect(unavailableCount(value) === 1, 'rota agents', `${unavailableCount(value)} painéis fora`);
      expect(value.includes('claude-sonnet-4-5'), 'rota agents', 'modelos sumiram junto');
    },
  },
  {
    part: 'active',
    overrides: { active: errorPart() },
    verify: (value) => {
      expect(unavailableCount(value) === 0, 'rota active', 'não deveria haver painel inteiro fora');
      expect(
        value.includes('Sessões em execução—'),
        'rota active',
        'contador de sessões ativas deveria virar travessão',
      );
    },
  },
  {
    part: 'service',
    overrides: { service: errorPart() },
    verify: (value) => {
      expect(value.includes('indisponível'), 'rota service', 'estado não virou indisponível');
      expect(value.includes('Fonte fora do ar neste teste.'), 'rota service', 'motivo ausente');
      expect(value.includes('Leitura do período'), 'rota service', 'leitura sumiu junto');
    },
  },
  {
    part: 'location',
    overrides: { location: errorPart() },
    verify: (value) => {
      expect(value.includes('Diretório—'), 'rota location', 'diretório deveria virar travessão');
      expect(!value.includes('~'), 'rota location', 'diretório antigo continuou na tela');
    },
  },
];

for (const scenario of routeScenarios) {
  response = overview(scenario.overrides);
  await unmount();
  await mount();
  scenario.verify(text());
  pass(`rota ${scenario.part}`, 'falha isolada, resto da página de pé');
}

await unmount();

await vite.close();

console.log(`\n${checks} verificações passaram`);

export {};
