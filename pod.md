# Plano de desenvolvimento — OpenCode Monitor

`prd.md` é a fonte de escopo. Este arquivo só organiza a execução: fases, entregáveis,
critérios de aceite e quais skills usar em cada momento. Nada aqui cria requisito novo;
quando houver dúvida sobre o que entra na v1, vale o PRD.

Registro da revisão das skills instaladas: `docs/skills-review.md`.

## Restrições que valem em todas as fases

Saíram do próprio PRD e não são negociáveis por fase:

1. Somente leitura. Nada é gravado — sem banco, sem arquivo de cache em disco, sem
   `localStorage` para dados.
2. A interface fala com um único endpoint, `/oc-api/overview`. Nenhum componente chama
   rota do OpenCode direto, e o navegador nunca vê o serviço local.
3. Todo acesso ao serviço passa por `opencode api get <rota>`. O app não lê token, não
   monta header de autenticação e não conhece a URL do serviço.
4. Se uma rota falhar, o dashboard continua. Falha é estado de um painel, não tela de
   erro geral.
5. Nenhum dado sai da máquina e nenhum recurso externo é carregado: sem CDN, sem fonte
   remota, sem telemetria, sem analytics.
6. Token, header de autenticação e corpo de prompt nunca aparecem em tela, log ou URL.

## Skills: o que usar, e o que não usar

Todas as listadas como utilizáveis foram revisadas e não têm dependência que falte neste
projeto.

| Skill | Quando usar | Por quê |
| --- | --- | --- |
| `opencode` | Fase 0 e sempre que uma rota surpreender | Toda rota do PRD vem de `opencode api get`. É a skill que confirma formato, campos e versão antes de codar contra eles |
| `codebase-design` | Fase 0, 1 e 2 | A camada de dados é o único ponto de arquitetura real. A skill obriga nomear a interface com invariantes e **modos de erro**, que é o que a degradação parcial exige |
| `diagnosing-bugs` | Quando um número sai errado, uma rota falha sem motivo ou o refresh trava | Cobre bug de rota experimental, de cache e de concorrência entre refresh manual e automático |
| `pt-br-copy` | Fase 2 em diante, em todo texto de interface | Rótulos, estados vazios, erro por painel e o painel de leitura do período são pt-BR |
| `secret-handling` | Fase 0, 5 e 6 | Amostras de resposta e títulos de sessão podem carregar token ou caminho local. Define o que redigir |
| `code-review-rubric` | Fase 7, sobre o diff de cada entrega | Revisão por severidade: intenção, regressão, fronteira de confiança, autorização, segredo, erro, estado, contrato, e estilo por último |
| `commit-style` | Fase 0 em diante, a cada commit | Conventional Commits em pt-BR, escopo pequeno |
| `wait-what` | Quando uma explicação técnica não fechar | Reexplica em linguagem simples, sem custo |
| `handoff` | Fim de sessão longa | Grava em `%TEMP%`, fora do projeto, e não duplica o que já está em `prd.md` ou neste plano |

Não usar nesta fase:

| Skill | Motivo |
| --- | --- |
| `implement` | Chama a skill `tdd`, que não está instalada. Também pressupõe branch e suíte de testes |
| `grill-me` | Chama a skill `grilling`, que não está instalada |
| `code-review` | Exige ponto fixo no Git e um issue tracker configurado por `/setup-matt-pocock-skills`, que não existe aqui. `code-review-rubric` cobre o mesmo terreno sem essa dependência |
| `pr` | Não há repositório remoto nem PR na v1 |
| `wizard` | Serve para provisionar terceiro, CI ou migração. Nada disso está no PRD |
| `third-party-skill-review`, `find-skills` | Só ao avaliar conteúdo de terceiro novo |

## Fase 0 — Contrato das rotas

Objetivo: saber exatamente o que cada rota devolve antes de escrever a camada de dados.

Tarefas:

1. `git init` e `.gitignore` (`node_modules`, `.env`, `.scratch`).
2. Rodar as seis rotas do PRD e guardar uma amostra real de cada uma em `.scratch/`,
   ignorado pelo Git.
3. Redigir qualquer token, header ou caminho pessoal nas amostras antes de olhar o
   conteúdo: usar `secret-handling`.
4. Anotar, por rota: campos, tipos, unidades, o que é nulo, o que varia por período.
5. Resolver as perguntas abertas da seção final.

Entregável: módulo de tipos com os contratos observados, ainda sem lógica.

Aceite: existe uma amostra por rota, o formato de `stats`, `session` e `agent` está
documentado, e nenhuma amostra contém credencial.

Skills: `opencode`, `codebase-design`, `secret-handling`.

## Fase 1 — Núcleo de dados

Objetivo: uma função que devolve o overview do período e sabe dizer o que falhou.

Tarefas:

1. Adaptador do CLI: uma função, um lugar, que executa `opencode api get` e devolve JSON
   tipado ou erro classificado.
2. Classificar erro em: CLI ausente, CLI sem autenticação, serviço fora, timeout, JSON
   inválido, rota inexistente na versão instalada.
3. Agregador: chama as rotas em paralelo, monta o overview, e devolve o estado de cada
   parte em vez de abortar tudo.
4. Cache em memória de 10 s, com chave por período.
5. Derivar a série diária de tokens e custo a partir das sessões, como o PRD descreve,
   mantendo marcada a diferença de origem em relação aos totais de `stats`.

Entregável: camada de dados testável por chamada direta, sem subir a interface.

Aceite: com o serviço fora, a função devolve overview parcial com todos os blocos
marcados como indisponíveis, e não lança. Com duas chamadas em menos de 10 s, o CLI roda
uma vez.

Skills: `codebase-design`, `diagnosing-bugs`, `opencode`.

## Fase 2 — Endpoint `/oc-api/overview`

Objetivo: expor a camada de dados para o navegador pelo middleware do Vite.

Tarefas:

1. Middleware do servidor Vite servindo `/oc-api/overview` com `from`, `to` e `timezone`.
2. Validar e normalizar entrada inválida sem derrubar o processo.
3. Responder erro de aplicação com corpo útil para a interface distinguir "sem dados" de
   "serviço indisponível".
4. Garantir que a resposta nunca inclui caminho absoluto, token ou stack trace.

Aceite: `curl http://localhost:5173/oc-api/overview?from=...&to=...` devolve 200 com
overview parcial quando o serviço está fora, e o corpo não contém segredo nem caminho do
sistema.

Skills: `codebase-design`, `pt-br-copy`, `secret-handling`.

## Fase 3 — Casca da interface e estado de atualização

Objetivo: a barra superior, o seletor de período e o ciclo de atualização funcionando.

Tarefas:

1. Layout base com Tailwind v4, sem CDN.
2. Barra superior: título, estado do serviço, seletor de 1/7/30/90 dias e tudo,
   atualização manual.
3. Atualização automática de 30 s com pausa e retomada; a pausa não afeta o botão manual.
4. Estado de carregamento que não apaga o último dado bom.

Aceite: trocar o período refaz a consulta; pausar impede a chamada automática; retomar
volta a chamar; refresh manual funciona pausado ou não.

Skills: `codebase-design`, `pt-br-copy`.

## Fase 4 — KPIs e séries

Objetivo: os números do topo e os três gráficos.

Tarefas:

1. Cartões de KPI: sessões, subagentes, prompts, passos, tokens por tipo, custo.
2. Atividade: passos por dia em barras e sessões iniciadas em linha.
3. Tokens por dia empilhados por tipo.
4. Custo acumulado no período.
5. Nota visível sobre a origem da série diária de tokens e custo, conforme o PRD.

Aceite: cada painel mostra dado ou estado "indisponível" com motivo; nenhum gráfico
quebra com série vazia; a nota de origem aparece.

Skills: `pt-br-copy`, `codebase-design`.

## Fase 5 — Rankings e tabelas

Objetivo: modelos, agentes, ferramentas e sessões recentes.

Tarefas:

1. Ranking de modelos em barras, com tabela ao lado.
2. Tabela de agentes carregados.
3. Ferramentas: barras de chamadas e tabela com falhas e p50.
4. Tabela de sessões recentes, paginando por cursor até cobrir o período.
5. Truncar ou omitir título de sessão que contenha caminho ou dado pessoal.

Aceite: período longo carrega por cursor sem travar a interface; p50 e taxa de falha
batem com o que `stats?tools=detail` devolve; nenhuma célula expõe caminho absoluto ou
credencial.

Skills: `pt-br-copy`, `secret-handling`.

## Fase 6 — Leitura do período e painel de serviço

Objetivo: fechar a última camada de leitura.

Tarefas:

1. Painel com texto gerado a partir dos números do período: o que cresceu, o que
   concentrou custo, onde houve falha.
2. Painel de serviço: versão, PID, estado, capacidades, diretório do serviço.
3. Nota sobre a fonte dos dados e sobre o que é agregado pelo servidor e o que é
   calculado aqui.

Aceite: o texto muda com o período e não inventa número que não esteja no overview; o
painel de serviço mostra o estado real, inclusive quando o CLI não responde.

Skills: `pt-br-copy`, `secret-handling`.

## Fase 7 — Revisão e fechamento

Tarefas:

1. Rodar `code-review-rubric` sobre o diff acumulado, corrigindo por severidade.
2. Verificar a degradação rota por rota, derrubando cada uma e conferindo o painel
   correspondente.
3. Confirmar ausência de persistência: nada em disco, nada em `localStorage`.
4. Confirmar ausência de saída de rede para fora de `localhost`.
5. Commits pequenos em pt-BR, conforme `commit-style`.

Aceite: a definição de pronto abaixo está satisfeita item por item.

Skills: `code-review-rubric`, `commit-style`, `diagnosing-bugs`.

## Definição de pronto da v1

- [ ] Todos os itens de **Interface** do PRD existem e respondem ao período escolhido.
- [ ] As seis rotas do PRD são consumidas pelo servidor, e nenhuma pelo navegador.
- [ ] Cada rota pode falhar sozinha sem derrubar o dashboard.
- [ ] Cache de 10 s e atualização de 30 s com pausa funcionam como descrito.
- [ ] Nada é gravado em disco, banco ou `localStorage`.
- [ ] Nenhuma requisição sai para host diferente de `localhost`.
- [ ] Token, header de autenticação e prompt não aparecem em tela, log ou URL.
- [ ] A interface roda em `localhost`, sem CDN e sem fonte remota.
- [ ] O que está em **Fora de escopo (v1)** do PRD continua fora.

## Perguntas abertas, resolvidas na fase 0

Estas respostas vêm da observação das rotas, não de decisão de produto:

1. Como "tudo" se traduz em `from` e `to` para `stats` e para `session`?
2. Quais formatos `timezone` aceita, e o que acontece com nome inválido?
3. Custo vem em que unidade, e há arredondamento por sessão que distorça a soma diária?
4. `stats?tools=detail` entrega p50 pronto ou exige cálculo sobre as chamadas?
5. Quanto de `session` vem por página, e até onde o cursor precisa ir para 90 dias?
6. Qual campo de sessão serve de dia de criação para agrupar tokens e custo?
7. A rota `experimental` de `stats` existe na versão instalada, e o `/api/info` permite
   detectar mudança de contrato?
8. `agent` conta agentes carregados ou configurados?

Se alguma resposta exigir ampliar escopo, pare e consulte. Não decida sozinho.

Respostas levantadas em 2026-10-22: `docs/api-contract.md`.

## Status

| Fase | Estado | Fechamento |
| --- | --- | --- |
| 0 — contrato das rotas | concluída em 2026-10-22 | `5ab92a5` |
| 1 — núcleo de dados | concluída em 2026-10-22 | `2794d68` |
| 2 — endpoint `/oc-api/overview` | pendente | — |
| 3 a 7 | pendente | — |

Verificação da fase 1: `node scripts/check-overview.ts`, nove casos, todos passando.
