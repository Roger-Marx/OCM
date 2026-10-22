/**
 * Verificação do endpoint /oc-api/overview (fase 2).
 * Precisa do dev server rodando:
 *
 *   npm run dev
 *   node scripts/check-endpoint.ts
 *
 * Para testar a queda total do serviço, suba outra instância apontando o binário
 * para um nome inexistente e aponte OCM_BASE para ela:
 *
 *   $env:OCM_OPENCODE_BIN='nao-existe'; npm run dev -- --port 5174
 *   $env:OCM_BASE='http://localhost:5174'; node scripts/check-endpoint.ts --degradado
 */
const BASE = process.env.OCM_BASE ?? 'http://localhost:5173';
const degraded = process.argv.includes('--degradado');

let checks = 0;
function pass(label: string, detail = ''): void {
  checks += 1;
  console.log(`ok   ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail: string): never {
  console.error(`FALHA ${label} — ${detail}`);
  process.exit(1);
}

async function call(query: string, init?: RequestInit): Promise<{ status: number; headers: Headers; body: unknown; text: string }> {
  const response = await fetch(`${BASE}/oc-api/overview${query}`, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body, text };
}

function assertNoLeak(text: string, label: string): void {
  if (/[A-Za-z]:\\\\/.test(text)) fail(label, 'vazou caminho absoluto do Windows');
  if (/\\Users\\/.test(text)) fail(label, 'vazou perfil do usuário');
  if (/"detail"\s*:/i.test(text)) fail(label, 'vazou detalhe do CLI');
  if (/"?(token|authorization|bearer)"?\s*:/i.test(text)) fail(label, 'vazou credencial');
  if (/at\s+\S+\s+\(.*:\d+:\d+\)/.test(text)) fail(label, 'vazou stack trace');
}

if (degraded) {
  const ok = await call('?preset=7d&timezone=America/Sao_Paulo');
  if (ok.status !== 200) fail('queda total', `status ${ok.status}`);

  const body = ok.body as { stats?: { status?: string }; daily?: { status?: string }; service?: { status?: string } };
  if (body.stats?.status !== 'error') fail('queda total', 'stats deveria estar em erro');
  if (body.daily?.status !== 'error') fail('queda total', 'daily deveria estar em erro');
  if (body.service?.status !== 'error') fail('queda total', 'service deveria estar em erro');

  assertNoLeak(ok.text, 'queda total');
  pass('queda total', '200 com todas as partes em erro e sem vazamento');
  console.log(`\n${checks} verificações passaram`);
  process.exit(0);
}

const real = await call('?preset=7d&timezone=America/Sao_Paulo');
if (real.status !== 200) fail('serviço real', `status ${real.status}`);
assertNoLeak(real.text, 'serviço real');

const overview = real.body as {
  period?: { preset?: string; from?: number; to?: number; timezone?: string };
  stats?: { status?: string };
  daily?: { status?: string; data?: { points?: unknown[] } };
  sessions?: { status?: string };
  service?: { status?: string };
  location?: { status?: string; data?: { display?: string } };
};

if (overview.period?.preset !== '7d') fail('serviço real', 'preset não voltou');
if (overview.period?.timezone !== 'America/Sao_Paulo') fail('serviço real', 'fuso não voltou');
if (overview.stats?.status !== 'ok') fail('serviço real', 'stats não está ok');
if (overview.daily?.status !== 'ok') fail('serviço real', 'daily não está ok');
if (!overview.daily.data?.points?.length) fail('serviço real', 'série vazia');

const display = overview.location?.data?.display ?? '';
if (overview.location?.status === 'ok' && !/^(~|…\/)/.test(display)) {
  fail('caminho abreviado', `veio "${display}"`);
}

pass('serviço real', `${overview.daily.data.points.length} dias, location=${display || 'n/d'}`);

const badZone = await call('?preset=7d&timezone=Not/AZone');
if (badZone.status !== 400) fail('fuso inválido', `status ${badZone.status}`);

const inverted = await call(`?from=2000&to=1000&timezone=America/Sao_Paulo`);
if (inverted.status !== 400) fail('intervalo invertido', `status ${inverted.status}`);

const notNumber = await call(`?from=abc&to=1000`);
if (notNumber.status !== 400) fail('from não numérico', `status ${notNumber.status}`);

const notGet = await call('?preset=7d', { method: 'POST' });
if (notGet.status !== 405) fail('método', `status ${notGet.status}`);
if (!/GET/.test(notGet.headers.get('allow') ?? '')) fail('método', 'header allow ausente');

pass('entrada recusada', 'fuso, intervalo e from não numérico com 400; POST com 405');

console.log(`\n${checks} verificações passaram`);

export {};
