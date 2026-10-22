# OpenCode Monitor

Dashboard local para acompanhar atividade, consumo e saúde do OpenCode instalado na
máquina. Roda em `localhost` e lê os dados do serviço local do OpenCode.

## Objetivo

Dar visão de um período (1, 7, 30, 90 dias ou tudo) sobre:

- volume de trabalho: sessões, subagentes, prompts e passos
- consumo: tokens de entrada, saída, raciocínio e cache
- custo acumulado
- modelos e agentes mais usados
- uso de ferramentas com taxa de sucesso e latência
- estado do serviço local

## Fonte de dados

O serviço do OpenCode exige autenticação e não expõe CORS para o navegador. Por isso o
app não fala com ele direto. Um middleware do próprio servidor Vite executa
`opencode api get <rota>` (o caminho oficial suportado pelo CLI, que já resolve
descoberta e autenticação) e devolve o JSON para a interface.

Endpoints consumidos:

| Rota | Uso |
| --- | --- |
| `/api/info` | versão, PID, URL, capacidades, caminho temporário |
| `/api/experimental/session/stats?from&to&tools=detail&timezone` | totais, atividade diária, modelos, ferramentas |
| `/api/session?limit&order&cursor` | série diária de sessões/tokens/custo e tabela de sessões |
| `/api/agent` | quantidade de agentes carregados |
| `/api/session/active` | sessões em execução agora |
| `/api/location` | diretório do serviço |

Nada é gravado. Nenhum arquivo fora do projeto é lido, e nenhum dado sai da máquina.

### Série diária

`stats` entrega passos por dia, mas não tokens nem custo por dia. Essas séries são
calculadas a partir das sessões (tokens e custo por sessão, agrupados pelo dia de
criação) e a interface informa isso. Totais de tokens e custo do topo também vêm de
`stats`, que é a fonte agregada do servidor.

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + Recharts.

- O cliente consome um único endpoint intermediário (`/oc-api/overview`) que agrupa as
  chamadas e degrada parcialmente: se uma rota falhar, o resto do dashboard continua.
- Cache curto em memória no servidor (10 s) evita disparar o CLI a cada refresh.
- Atualização automática a cada 30 s, com botão de atualização manual e pausa.

## Interface

- Barra superior: título, estado do serviço, seletor de período, atualização.
- Cartões de indicadores (KPIs) com totais do período.
- Gráfico de atividade: passos por dia (barras) e sessões iniciadas (linha).
- Gráfico de tokens por dia, empilhado por tipo.
- Gráfico de custo acumulado no período.
- Ranking de modelos (barras + tabela) e tabela de agentes.
- Ferramentas: barras de chamadas e tabela com falhas e p50.
- Painel de leitura do período (texto gerado a partir dos números).
- Tabela de sessões recentes.
- Painel de serviço e nota sobre a fonte dos dados.

## Fora de escopo (v1)

- Histórico persistido em banco próprio
- Alertas e notificações
- Edição de sessões, agentes ou configuração
- Comparação entre máquinas
