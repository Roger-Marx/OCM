# Revisão de skills de terceiro

Registro da revisão feita antes de instalar o pacote de skills em `.opencode/skills/`.

## Veredito

ACEITAR COM RESSALVA

- **Pacote:** 9 skills de `mattpocock/skills` (via `skills-lock.json`).
- **Origem:** `C:\Users\Roger\Documents\quarantine\.agents\skills`.
- **Data:** 2026-10-22.
- **Destino:** `.opencode/skills/` neste projeto.

## Arquivos revisados (23)

| Skill | Arquivos | Disparo automático |
| --- | --- | --- |
| code-review | `SKILL.md`, `agents/openai.yaml` | sim |
| codebase-design | `SKILL.md`, `DEEPENING.md`, `DESIGN-IT-TWICE.md`, `agents/openai.yaml` | sim |
| diagnosing-bugs | `SKILL.md`, `scripts/hitl-loop.template.sh`, `agents/openai.yaml` | sim |
| pr | `SKILL.md`, `CREDITS.md`, `agents/openai.yaml` | sim |
| wizard | `SKILL.md`, `template.sh`, `agents/openai.yaml` | sim |
| grill-me | `SKILL.md`, `agents/openai.yaml` | não (`disable-model-invocation`) |
| handoff | `SKILL.md`, `agents/openai.yaml` | não |
| implement | `SKILL.md`, `agents/openai.yaml` | não |
| wait-what | `SKILL.md`, `agents/openai.yaml` | não |

Todos os arquivos foram lidos na íntegra. Nenhum script foi executado durante a
revisão.

## Achados

- **médio — `skills-lock.json`, todas as 9 entradas:** o `computedHash` não confere
  com o SHA-256 local, nem com variações de normalização de fim de linha (CRLF,
  LF, com e sem newline final). A integridade em relação ao upstream não pôde ser
  confirmada localmente. O conteúdo lido é coerente com a origem declarada, mas o
  hash não prova nada aqui.
- **baixo — `wizard`:** o script gerado grava segredos reais em `.env` via
  `write_env` e pode chamar `gh secret set`. Antes de usar, confirme que `.env`
  está no `.gitignore` do projeto. O `template.sh` é modelo, não script para rodar
  como está.
- **baixo — `diagnosing-bugs/scripts/hitl-loop.template.sh`:** modelo com
  `localhost:3000`; só roda depois de editado.
- **nota — referências internas quebradas:** `grill-me` chama a skill `grilling`,
  `implement` chama `tdd`, e `code-review`, `pr`, `wait-what`, `diagnosing-bugs`
  esperam `GLOSSARY.md` / `GLOSSARY-MAP.md`. Nenhuma dessas existe neste pacote nem
  neste projeto. São links mortos de qualidade, sem risco de segurança.
- **nota — quarentena:** `.opencod/skills/` contém 9 junctions de volta para
  `.agents/skills/`. Não foram copiadas. `.agents/skills/` é uma raiz de descoberta
  de skills, então manter o pacote em `Documents\quarantine` é aceitável apenas
  enquanto essa pasta não for aberta como raiz de projeto.

## Buscas executadas

`Select-String` sobre os 23 arquivos, por: injeção de prompt, `curl`/`wget`/
`fetch(`/`npm install`/`pip install`/`npx`, credencial (`id_rsa`, `.ssh`, `.aws`,
`.npmrc`, `process.env`), escape de caminho (`../`, `C:\`, `/etc/`, `~/`),
execução (`eval`, `Invoke-Expression`, `rm -rf`, `Remove-Item -Recurse`, base64
longo, comentário HTML) e Unicode invisível (`\u200B-\u200F`, `\u202A-\u202E`,
`\u2060-\u2064`, `\uFEFF`). Nenhum acerto de risco.

## Risco residual

- Hash divergente: se o pacote foi adulterado no caminho, a revisão textual não
  detectaria uma alteração sutil em texto que ainda parece legítimo.
- `wizard` e `diagnosing-bugs` operam sobre segredos e ambiente real por desenho.
  A revisão cobre a instrução, não o que o agente gerar depois ao usá-las.
- Arquivo copiado sem versão fixada: não há como comparar com atualização futura
  do upstream sem recalcular os hashes.
