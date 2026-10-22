import type { OverviewResponse } from '../../api/overview.ts';
import { buildReading } from '../../client/reading.ts';
import { Panel, PanelEmpty } from '../Panel.tsx';

/** Texto do período. Cada frase sai de um número do próprio overview. */
export function ReadingPanel({ overview }: { overview: OverviewResponse }) {
  const lines = buildReading(overview);

  return (
    <Panel title="Leitura do período" description="Gerada a partir dos números desta leitura.">
      {lines.length === 0 ? (
        <PanelEmpty message="Não há números suficientes nesta leitura para descrever o período." />
      ) : (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
