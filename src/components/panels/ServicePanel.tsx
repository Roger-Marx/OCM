import type { ReactNode } from 'react';
import type { Part, ServiceSummary } from '../../api/overview.ts';
import { formatNumber } from '../../client/format.ts';
import { Panel } from '../Panel.tsx';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-b-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function ptyLabel(value: boolean | null): string {
  if (value === null) return 'desconhecido';
  return value ? 'sim' : 'não';
}

/** Estado real da instância local, inclusive quando o CLI não responde. */
export function ServicePanel({
  service,
  location,
  active,
}: {
  service: Part<ServiceSummary>;
  location: Part<{ display: string }>;
  active: Part<{ total: number }>;
}) {
  const up = service.status === 'ok';

  return (
    <Panel title="Serviço" description="Instância local do OpenCode.">
      <dl className="text-sm">
        <Row label="Estado">
          <span className="inline-flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${up ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
            {up ? 'ativo' : 'indisponível'}
          </span>
        </Row>

        <Row label="Versão">{up ? service.data.version : '—'}</Row>
        <Row label="PID">{up ? formatNumber(service.data.pid) : '—'}</Row>
        <Row label="PTY persistente">{up ? ptyLabel(service.data.persistentPty) : '—'}</Row>
        <Row label="Diretório">{location.status === 'ok' ? location.data.display : '—'}</Row>
        <Row label="Sessões em execução">
          {active.status === 'ok' ? formatNumber(active.data.total) : '—'}
        </Row>
      </dl>

      {service.status === 'error' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {service.error.message}
        </p>
      )}
    </Panel>
  );
}
