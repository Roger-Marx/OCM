import type { IncomingMessage, ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { createOverview } from './opencode/index.ts';
import type { Overview } from './opencode/overview.ts';
import type { OverviewError, OverviewResponse } from '../api/overview.ts';
import type { PeriodInput } from './opencode/period.ts';

/**
 * Endpoint único que a interface consome. O navegador nunca fala com o serviço
 * local: toda chamada sai daqui, pelo CLI.
 *
 * O cliente fica no módulo, não na requisição, para o cache de 10 s valer entre
 * refreshes. Duas abas abertas compartilham a mesma janela de cache.
 */
const client = createOverview();

const HEADERS_JSON = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

/**
 * Caminho nunca sai inteiro: vira `~` dentro do perfil do usuário e, fora dele,
 * só os dois últimos segmentos. O painel de serviço continua legível sem publicar
 * a árvore de diretórios da máquina.
 */
export function displayPath(directory: string): string {
  const toPosix = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const target = toPosix(directory);
  const home = toPosix(homedir());

  if (home && target === home) return '~';
  if (home && target.startsWith(`${home}/`)) return `~${target.slice(home.length)}`;

  const parts = target.split('/').filter((part) => part.length > 0);
  return parts.length <= 2 ? parts.join('/') : `…/${parts.slice(-2).join('/')}`;
}

/** Projeção enviada ao navegador: mesma forma, sem caminho absoluto. */
function toPublic(overview: Overview): OverviewResponse {
  const { location, ...rest } = overview;

  return {
    ...rest,
    location:
      location.status === 'ok'
        ? { status: 'ok', data: { display: displayPath(location.data.directory) } }
        : location,
  };
}

function parseQuery(url: URL): PeriodInput {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  return {
    preset: url.searchParams.get('preset') ?? undefined,
    timezone: url.searchParams.get('timezone') ?? undefined,
    from: from === null ? undefined : Number(from),
    to: to === null ? undefined : Number(to),
  };
}

function send(res: ServerResponse, status: number, body: unknown, isHead: boolean): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...HEADERS_JSON, 'content-length': Buffer.byteLength(payload) });
  res.end(isHead ? undefined : payload);
}

function sendError(res: ServerResponse, status: number, error: OverviewError, isHead: boolean): void {
  send(res, status, { error }, isHead);
}

export async function overviewHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const isHead = req.method === 'HEAD';

  if (req.method !== 'GET' && !isHead) {
    res.setHeader('allow', 'GET, HEAD');
    sendError(
      res,
      405,
      { kind: 'invalid-input', message: 'Este endpoint só aceita GET.' },
      false,
    );
    return;
  }

  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const result = await client.getOverview(parseQuery(url));

    if (!result.ok) {
      // Entrada inválida nunca chega ao CLI: é recusada antes.
      sendError(res, 400, result.error, isHead);
      return;
    }

    send(res, 200, toPublic(result.overview), isHead);
  } catch {
    // Stack trace não sai daqui. O detalhe fica no log do processo, se houver.
    sendError(
      res,
      500,
      { kind: 'cli-error', message: 'Falha inesperada ao montar o overview.' },
      isHead,
    );
  }
}
