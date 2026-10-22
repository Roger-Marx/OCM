interface TooltipItem {
  name?: string | number;
  value?: number | string | null;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipItem[];
  /** Formata o valor de cada série. */
  format: (value: number) => string;
  /** Formata o rótulo do eixo (a data). */
  labelFormat?: (label: string) => string;
}

/**
 * Tooltip próprio: o padrão do Recharts mostra número cru e nome de `dataKey`.
 * Aqui o valor sai formatado em pt-BR e a data em dd/mm/aaaa.
 */
export function ChartTooltip({ active, label, payload, format, labelFormat }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = typeof label === 'string' && labelFormat ? labelFormat(label) : String(label ?? '');

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{heading}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((item) => (
          <li
            key={String(item.dataKey ?? item.name)}
            className="flex items-center gap-2 text-xs text-neutral-700"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color ?? '#a3a3a3' }}
              aria-hidden="true"
            />
            <span className="text-neutral-500">{item.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {typeof item.value === 'number' ? format(item.value) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
