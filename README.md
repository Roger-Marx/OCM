# OpenCode Monitor

Painel local, somente leitura, para acompanhar atividade, consumo e saúde do OpenCode
nesta máquina. A interface roda em `localhost`, lê o serviço local do OpenCode pelo CLI
e não guarda nada.

## O que você vê

- Barra superior com estado do serviço, seletor de período (1, 7, 30, 90 dias ou tudo),
  atualização manual e pausa.
- Cartões com os totais do período: sessões, subagentes, prompts, passos, custo e tokens
  por tipo.
- Atividade por dia: passos em barras e sessões iniciadas em linha.
- Tokens por dia, empilhados por entrada, saída, raciocínio e cache.
- Custo acumulado do período.
- Ranking de modelos com tabela de passos, tokens e custo.
- Tabela de agentes carregados.
- Ferramentas com chamadas, falhas, taxa de falha e latência mediana (p50).
- Leitura do período: frases geradas a partir dos números daquela leitura.
- Sessões recentes do período.
- Painel de serviço com estado, versão, PID, PTY, diretório e sessões em execução.
- Nota sobre a origem dos números.

## Requisitos

- Node 24 ou mais novo (os scripts de verificação rodam `.ts` direto).
- OpenCode instalado nesta máquina e serviço local ativo.

No Windows, o `opencode` instalado por npm é um shim `.cmd`, que não pode ser executado
sem shell. O servidor resolve o `.exe` real ao lado do prefixo npm. Para apontar outro
binário, use `OCM_OPENCODE_BIN` com o caminho completo.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. A porta é fixa (`strictPort`): se estiver ocupada, o Vite
encerra em vez de trocar de porta.

Para servir o build:

```bash
npm run build
npm run preview
```

O endpoint local é montado no dev e no preview. Em ambos os casos, o processo do Vite
precisa rodar na mesma máquina do serviço do OpenCode, porque é ele que executa o CLI.

## De onde vêm os números

O navegador só conhece `/oc-api/overview`. Quem chama o OpenCode é o servidor, sempre
por `opencode api get`, nunca pelo navegador.

| Rota do OpenCode | Uso |
| --- | --- |
| `/api/info` | versão, PID e capacidades do serviço |
| `/api/location` | diretório do serviço, abreviado antes de sair |
| `/api/agent` | agentes carregados |
| `/api/session/active` | sessões em execução agora |
| `/api/session?limit&order&cursor` | série diária de sessões, tokens e custo; tabela de sessões |
| `/api/experimental/session/stats?from&to&timezone&tools=detail` | totais do período, atividade por dia, modelos e ferramentas |

Os totais do topo vêm de `stats`, como o PRD define. Tokens e custo por dia são somados
a partir das sessões, agrupados pelo dia de criação no fuso do navegador. As duas fontes
podem divergir; cada painel mantém a sua e a nota no fim da página explica isso em vez de
forçar um número a combinar com o outro.

## Endpoint local

```
GET /oc-api/overview?preset=7d&timezone=America/Sao_Paulo
```

- `preset`: `1d`, `7d`, `30d` (padrão do servidor), `90d` ou `all`.
- `timezone`: fuso IANA. Ausente, usa o fuso do processo.
- `from` e `to`: epoch em milissegundos, para scripts. Substituem a janela do preset e
  são recusados acima de 4.000 dias. Com `preset=all`, `from` e `to` são ignorados.
- Entrada inválida responde 400 antes de chegar ao CLI. Outros métodos respondem 405.

Cada fonte do corpo (`stats`, `daily`, `sessions`, `agents`, `active`, `service`,
`location`) traz `status: "ok"` com os dados ou `status: "error"` com um motivo em
português. Uma fonte que falha não derruba a resposta.

O servidor guarda a última leitura por 10 s. A página atualiza a cada 30 s, ou na hora,
no botão Atualizar. Pausar desliga só o relógio; atualizar à mão continua funcionando.
A listagem de sessões é paginada por cursor no servidor: o navegador recebe uma página
com as mais recentes e o total do período.

## Privacidade e confinamento

- O servidor não lê token, não monta header de autenticação e não imprime nada no console.
- Nada é gravado em disco, banco, `localStorage` ou cookie. O cache de 10 s vive na
  memória do processo do Vite e some quando ele para.
- O navegador fala com um único endereço, na mesma origem. Não há CDN, fonte remota,
  analytics ou imagem externa.
- Título de sessão com caminho local (Windows, POSIX, `~/`, UNC) ou e-mail é omitido
  inteiro antes de sair do servidor; a tabela mostra "Sem título".
- O diretório do serviço vira `~` dentro do perfil do usuário e, fora dele, só os dois
  últimos segmentos.
- O servidor escuta só em loopback. Requisição com `Host` de outro domínio recebe 403 do
  próprio Vite.

## Verificação

```bash
npm run typecheck
npm run build

node scripts/check-overview.ts   # 13 casos, o primeiro contra o serviço real
node scripts/check-refresh.ts    # 10 casos
node scripts/check-series.ts     # 5 casos
node scripts/check-reading.ts    # 8 casos
node scripts/check-panels.ts     # 15 casos, renderização em jsdom
node scripts/check-endpoint.ts   # 2 casos, precisa do dev server rodando
```

As verificações de dados usam dublês para simular falha de cada rota sem derrubar o
OpenCode de ninguém. A de endpoint, além do serviço real, testa 400, 405 e a queda total.

Para conferir a página com o CLI fora do ar de verdade:

```bash
# macOS e Linux
OCM_OPENCODE_BIN=nao-existe npm run dev -- --port 5174
OCM_BASE=http://localhost:5174 node scripts/check-endpoint.ts --degradado
```

```powershell
# PowerShell
$env:OCM_OPENCODE_BIN='nao-existe'; npm run dev -- --port 5174
$env:OCM_BASE='http://localhost:5174'; node scripts/check-endpoint.ts --degradado
```

## Limitações conhecidas

- A rota de `stats` é experimental. Se ela sumir ou mudar de forma em uma versão do
  OpenCode, os painéis que dependem dela mostram "Indisponível nesta leitura" com o
  motivo, e o resto da página continua.
- Em algumas leituras, `stats.cost` volta 0 enquanto as sessões somam um custo pequeno,
  acima de zero. O KPI mostra a fonte que o PRD nomeia; a série mostra a soma das
  sessões. A divergência fica visível e explicada.
- Barras, linhas e tooltips dos gráficos não têm prova automática: o jsdom monta os eixos,
  não o desenho. Essa parte precisa de conferência no navegador.
- A interface só oferece os presets. `from` e `to` existem para scripts e para o próprio
  servidor.
- Sem autenticação. O desenho assume uma máquina pessoal, com o servidor em loopback.

## Estrutura

```
src/
  api/          contrato do endpoint local, compartilhado entre os dois lados
  client/       hook de leitura, formatação, séries e texto do período
  components/   barra, KPIs, painéis, gráficos e tabela
  contract/     tipos das rotas do OpenCode
  server/       middleware e núcleo de dados (CLI, período, série, overview)
scripts/        verificações executáveis
docs/           contrato observado das rotas do OpenCode
```

## Documentos

- `prd.md`: escopo da v1.
- `pod.md`: plano por fases, decisões registradas e definição de pronto.
- `docs/api-contract.md`: o que foi observado nas rotas do OpenCode, com evidência.
