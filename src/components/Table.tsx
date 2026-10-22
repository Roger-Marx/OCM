import type { ReactNode } from 'react';

/**
 * Tabela simples. Colunas numéricas alinham à direita e usam `tabular-nums`,
 * para os dígitos ficarem na mesma coluna entre linhas.
 */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`border-b border-neutral-200 pb-2 pr-4 text-xs font-medium text-neutral-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  muted = false,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  muted?: boolean;
}) {
  return (
    <td
      className={`border-b border-neutral-100 py-2 pr-4 align-top last:pr-0 ${
        align === 'right' ? 'text-right tabular-nums' : ''
      } ${muted ? 'text-neutral-500' : ''}`}
    >
      {children}
    </td>
  );
}
