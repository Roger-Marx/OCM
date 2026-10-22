# Contrato das rotas — fase 0

Levantado em 2026-10-22 contra o serviço local, por `opencode api get`. Duas fontes:
o `/openapi.json` que o próprio serviço publica (OpenAPI 3.1.0, 119 rotas) e a
observação das respostas reais.

Tipos correspondentes: `src/contract/types.ts`.
Amostras brutas: `.scratch/raw/` (ignorado pelo Git, apagável).

## Como foi levantado

1. `/openapi.json` salvo localmente e resumido por esquema.
2. Seis rotas do PRD chamadas de verdade, cada resposta gravada em arquivo.
3. Parâmetros de `stats` isolados um por vez, porque a primeira chamada deu HTTP 500.
4. Forma das respostas conferida por um leitor que troca todo texto por `len=N` —
   título de sessão, caminho e ID nunca foram para a saída do terminal.

## Regras que a observação fixou

| Regra | Evidência |
| --- | --- |
| `from` e `to` são **epoch em ms**, não data ISO | `from=2026-09-22` dá HTTP 500; `from=1790035200000` funciona |
| Data ISO inválida derruba com **500**, não 400 | o serviço deveria recusar como requisição inválida; não recusa |
| Fim do intervalo é **exclusivo** no dia | `21→22` traz só o dia 21; `21→23` traz 21 e 22 |
| "Tudo" = `from=0` | `from=0` devolve `range.from` = 1970-01-01 |
| Sem `from`/`to`, o padrão é ~7,8 dias até agora | `range` devolvido cobre 1792011113996 → 1792684123124 |
| `timezone` aceita nome IANA e muda o balde do dia | `Pacific/Kiritimati` joga a mesma faixa para 2026-10-22; `UTC` e `America/Sao_Paulo` para 2026-10-21 |
| `timezone` inválido dá **400** | `timezone=Not/AZone` |
| `stats.sessions` conta raiz; `subagents` conta filhos | 50 raiz + 6 subagentes = as 56 sessões de `/api/session` |
| Faixa vazia não é erro | retorna zeros e arrays vazios, `tools.mode` preservado |
| `activity` é esparso | só dias com passo; a interface preenche os dias faltantes |
| `durationP50` vem pronto, em ms | campo por ferramenta em `tools=detail`; máximo observado 124503 |
| `tools` omitido devolve `mode: summary` | `detail` só com `tools=detail` explícito |
| Paginação para em página vazia | a última página com dados ainda trouxe `cursor.next`; a seguinte veio com 0 itens |
| `/api/session` não filtra por período | nenhum parâmetro de data; filtrar por `time.created` no servidor |
| `/api/session` não filtra por projeto | 56 sessões em 15 diretórios e 15 projetos distintos |
| `/api/session/active` não está no OpenAPI | schema diz `data: {}`; a forma real é um mapa por ID com `{ type: "running" }` |
| `/api/agent` devolve lista por localização | `data.length` é a contagem; neste ambiente, 0 |
| `/api/location` resolve a localização do serviço | 14 caracteres, não o diretório do projeto |

## Divergência de custo

`stats.cost` veio **0** em todas as faixas testadas, inclusive com `from=0`. A soma de
`cost` das 56 sessões foi **0.0006127**. Sessões raiz carregam todo o valor; os 6
subagentes têm custo 0, e 39 das 50 raízes também.

O PRD já define as duas fontes: KPI de custo vem de `stats`, série diária vem das
sessões. Então a divergência aparece na tela por construção. Duas consequências:

- Formatar em centavos esconde a diferença (ambos viram US$ 0,00). Formatar com mais
  casas expõe a inconsistência para quem usa.
- O KPI não deve ser "corrigido" com a soma das sessões sem decisão explícita: isso
  troca a fonte que o PRD nomeia.

Pendente de decisão do produto, não de implementação.

## Dados pessoais no payload

Estes campos existem e não vão para tela, log ou URL:

- `SessionInfo.title` — texto livre escrito pelo usuário.
- `SessionInfo.location.directory` e `subpath` — caminho absoluto da máquina.
- `InfoResponse.paths.tmp` — caminho local.
- `ApiError.message` — pode repetir trecho de caminho.

O `secret-handling` pede ainda: nenhum `Authorization`, token ou corpo de prompt em
resposta do `/oc-api/overview`, e mensagem de erro própria em vez da mensagem do serviço.

## Efeito em `/api/info`

`version` é string curta e `pid` é número. Não há campo de "capacidades" que liste
rotas: `capabilities` só traz `persistentPty`. Logo, a presença de
`/api/experimental/session/stats` **não** é detectável por `/api/info`. A camada de
dados tem de tratar 404 nessa rota como "recurso indisponível nesta versão", e não como
serviço fora.

## Perguntas abertas do plano

1. "Tudo" → `from=0`, `to` = agora. Fim exclusivo.
2. Fuso IANA aceito, muda o dia; inválido dá 400. Enviar sempre explícito.
3. Custo em dólar, fração cheia. Divergência acima.
4. `durationP50` vem pronto por ferramenta. Nada a calcular.
5. `limit` respeitado até 200; páginas terminam em página vazia.
6. Dia de criação = `time.created`, epoch ms, balde no fuso pedido.
7. Rota `experimental` existe aqui; versão não serve de sonda. Tratar 404 por rota.
8. `agent` devolve agentes da localização resolvida. Contagem = `data.length`.

## O que continua desconhecido

- Quais valores de `type` existem em `/api/session/active` além de `running`.
- Se `stats` e `/api/session` mudam de escopo quando se passa `project` ou
  `location.directory` — não são usados no PRD, então ficou fora.
- Se `stats.cost` fica diferente de zero com modelo pago.
