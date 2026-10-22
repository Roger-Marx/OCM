import type { Part, SessionSummary } from '../../api/overview.ts';
import { formatCost, formatDateTime, formatNumber, modelLabel } from '../../client/format.ts';
import { totalTokens } from '../../client/series.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { Table, Td, Th } from '../Table.tsx';

interface SessionData {
  items: SessionSummary[];
  total: number;
  complete: boolean;
}

/**
 * Sessões mais recentes do período. A paginação por cursor acontece no servidor;
 * o navegador recebe só esta página e o total, para não travar em período longo.
 */
export function SessionsPanel({ sessions }: { sessions: Part<SessionData> }) {
  if (sessions.status === 'error') {
    return (
      <Panel title="Sessões recentes" description="As mais recentes do período.">
        <PanelUnavailable message={sessions.error.message} />
      </Panel>
    );
  }

  const { items, total, complete } = sessions.data;

  if (items.length === 0) {
    return (
      <Panel title="Sessões recentes" description="As mais recentes do período.">
        <PanelEmpty message="Nenhuma sessão no período selecionado." />
      </Panel>
    );
  }

  const shown = `${formatNumber(items.length)} de ${formatNumber(total)} sessões no período`;

  return (
    <Panel
      title="Sessões recentes"
      description="As mais recentes do período."
      footer={complete ? shown : `${shown} · listagem parcial`}
    >
      <Table>
        <thead>
          <tr>
            <Th>Quando</Th>
            <Th>Título</Th>
            <Th>Agente</Th>
            <Th>Modelo</Th>
            <Th align="right">Tokens</Th>
            <Th align="right">Custo</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((session) => (
            <tr key={session.id}>
              <Td muted>{formatDateTime(session.created)}</Td>
              <Td>
                {session.title ?? <span className="text-neutral-400">Sem título</span>}
                {session.outcome === 'failed' && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                    falhou
                  </span>
                )}
                {session.outcome === 'interrupted' && (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                    interrompida
                  </span>
                )}
              </Td>
              <Td muted>{session.agent ?? '—'}</Td>
              <Td muted>{session.model ? modelLabel(session.model) : '—'}</Td>
              <Td align="right">{formatNumber(totalTokens(session.tokens))}</Td>
              <Td align="right">{formatCost(session.cost)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
