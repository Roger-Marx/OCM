import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Panel({ title, description, children, footer }: PanelProps) {
  return (
    <section className="flex flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>

      <div className="flex-1 px-5 py-4">{children}</div>

      {footer && (
        <div className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">{footer}</div>
      )}
    </section>
  );
}

/** Falha de uma fonte. O motivo é o que o servidor mandou, nunca detalhe do CLI. */
export function PanelUnavailable({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5">
      <p className="text-sm font-medium text-amber-900">Indisponível nesta leitura</p>
      <p className="mt-1 text-sm text-amber-800">{message}</p>
    </div>
  );
}

export function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}
