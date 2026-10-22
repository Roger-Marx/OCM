import type { AgentSummary, Part } from '../../api/overview.ts';
import { formatNumber, modelLabel } from '../../client/format.ts';
import { Panel, PanelEmpty, PanelUnavailable } from '../Panel.tsx';
import { Table, Td, Th } from '../Table.tsx';

const MODE_LABEL: Record<AgentSummary['mode'], string> = {
  subagent: 'subagente',
  primary: 'principal',
  all: 'todos',
};

/** Agentes carregados. Nesta instalação a lista vem vazia para o local padrão. */
export function AgentsPanel({ agents }: { agents: Part<{ total: number; items: AgentSummary[] }> }) {
  if (agents.status === 'error') {
    return (
      <Panel title="Agentes" description="Agentes carregados para este local.">
        <PanelUnavailable message={agents.error.message} />
      </Panel>
    );
  }

  const { items } = agents.data;

  if (items.length === 0) {
    return (
      <Panel title="Agentes" description="Agentes carregados para este local.">
        <PanelEmpty message="Nenhum agente carregado para este local." />
      </Panel>
    );
  }

  return (
    <Panel
      title="Agentes"
      description="Agentes carregados para este local."
      footer={`${items.length} agentes carregados.`}
    >
      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>Modo</Th>
            <Th>Modelo</Th>
            <Th>Oculto</Th>
            <Th align="right">Passos</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((agent) => (
            <tr key={agent.id}>
              <Td>{agent.name}</Td>
              <Td muted>{MODE_LABEL[agent.mode]}</Td>
              <Td muted>{agent.model ? modelLabel(agent.model) : '—'}</Td>
              <Td muted>{agent.hidden ? 'sim' : 'não'}</Td>
              <Td align="right">{agent.steps === undefined ? '—' : formatNumber(agent.steps)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
