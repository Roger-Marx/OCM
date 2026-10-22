import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Adaptador do CLI local: a única porta que executa `opencode api get`.
 *
 * Por que não shell: a rota leva `&` na query string. Passar por `cmd /c` exigiria
 * aspas em cada argumento e abriria espaço para injeção. O binário é resolvido e
 * chamado direto, sem shell.
 */

export const CLI_TIMEOUT_MS = 20_000;

export type ErrorKind =
  | 'cli-missing'
  | 'unauthorized'
  | 'route-missing'
  | 'timeout'
  | 'invalid-json'
  | 'http-error'
  | 'cli-error';

export interface RouteError {
  kind: ErrorKind;
  /** Detalhe local, com caminho e mensagem do CLI. Não sai do servidor. */
  detail: string;
}

export type RouteResult<T> = { ok: true; data: T } | { ok: false; error: RouteError };

export type RouteFetcher = <T>(route: string) => Promise<RouteResult<T>>;

let cachedBinary: string | null = null;

/**
 * No Windows o `opencode` instalado por npm é um shim `.cmd`/`.ps1`, que não pode
 * ser executado sem shell. O alvo real é o `.exe` ao lado do `node_modules` do
 * prefixo npm, então resolvemos uma vez e guardamos.
 */
export function cliBinary(): string {
  if (cachedBinary) return cachedBinary;

  const override = process.env.OCM_OPENCODE_BIN;
  if (override) {
    cachedBinary = override;
    return override;
  }

  if (process.platform === 'win32') {
    try {
      const found = execFileSync('where.exe', ['opencode'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const first = found
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (first) {
        const candidate = join(dirname(first), 'node_modules', '@opencode', 'cli', 'bin', 'opencode.exe');
        if (existsSync(candidate)) {
          cachedBinary = candidate;
          return candidate;
        }
        if (first.toLowerCase().endsWith('.exe')) {
          cachedBinary = first;
          return first;
        }
      }
    } catch {
      // sem `where.exe` ou sem opencode no PATH: cai no nome puro e o spawn classifica.
    }
  }

  cachedBinary = 'opencode';
  return cachedBinary;
}

/** Remove caminho absoluto e credencial do detalhe que fica só no servidor. */
function sanitize(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<caminho>')
    .replace(/(?:\/[\w.-]+){3,}/g, '<caminho>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function classify(err: unknown, stderr: string): ErrorKind {
  const error = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string };

  if (error.code === 'ENOENT' || error.code === 'EACCES') return 'cli-missing';
  if (error.killed || error.signal === 'SIGTERM') return 'timeout';
  if (/HTTP 401|HTTP 403/.test(stderr)) return 'unauthorized';
  if (/HTTP 404/.test(stderr)) return 'route-missing';
  if (/HTTP \d{3}/.test(stderr)) return 'http-error';

  return 'cli-error';
}

export const fetchRoute: RouteFetcher = <T,>(route: string): Promise<RouteResult<T>> =>
  new Promise((resolve) => {
    execFile(
      cliBinary(),
      ['api', 'get', route],
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            ok: false,
            error: { kind: classify(err, stderr), detail: sanitize(stderr || err.message) },
          });
          return;
        }

        try {
          resolve({ ok: true, data: JSON.parse(stdout) as T });
        } catch {
          resolve({
            ok: false,
            error: { kind: 'invalid-json', detail: 'resposta nao era json' },
          });
        }
      },
    );
  });
