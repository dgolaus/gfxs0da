# Travada na entrada do hero: relatório final

Branch `perf-investigation`. O `main` não foi tocado e nada foi publicado.
O patch está aplicado em `script.js` e `styles.css` neste branch, num commit só. Uma cópia está em
`fixes/final/final.patch`, e os arquivos servidos estão em `fixes/final/`.

## O que entrou

1. **Base aprovada** (4 fixes já aprovados antes, juntados em `fixes/approved-base/`):
   - `raf-loops-noop-writes` e `-plus-leave` (versão amended: o primeiro `--fp` sempre é escrito).
     O gradiente 6c lê tudo antes de escrever e só escreve quando muda; não escreve mais no pai `.accent`.
     O 6d (`--leave`) faz o mesmo.
     As variáveis da pill da nav vão para o `#nav` em vez do `<html>`, o que evita restyle da página inteira.
     O footer `--fp` só escreve quando muda.
   - `raf-loops-leave-noinherit`: `@property --leave { inherits: false }`.
   - `forced-layout-batch`: o preenchimento das colunas de depoimentos lê as alturas de uma vez e clona via DocumentFragment.
2. **stable-layerize (amended)**: `@media (min-width: 1440px) { #main > #pricing { contain: paint } }`.
   Evita que o Chrome refaça a layerização da página inteira a cada frame por causa dos cards de preço flutuando.

## Números (nesta máquina de nuvem, não no seu PC)

CPU 4x, 1440x900, modo desktop com Lenis ativo (`bench-real.js`).
Baseline e final intercalados, 10 repetições, mediana (`fixes/final/timing_real_10.json`).

| | antes | depois |
|---|---|---|
| ENTRADA FPS | 8.1 | 9.8 |
| ENTRADA p95 do frame | 433ms | 317ms |
| ENTRADA pior frame | 700ms | 433ms |
| ENTRADA long tasks | 11 / 1624ms | 10 / 1181ms |
| ENTRADA tempo perdido vs 60fps | 2849ms | 2799ms |
| recalcs de estilo (até 8.5s) | 213 | 178 |
| ESTÁVEL FPS / p95 | 14.0 / 133ms | 13.6 / 133ms (sem diferença) |

Como ler: o pior frame da entrada cai 38% e somem cerca de 440ms de long task.
O tempo "perdido" quase não muda, porque esta máquina já roda a entrada inteira muito abaixo de 60fps
(baseline de 8 FPS aqui, contra 16 no seu PC).
O layout grande de ~433ms da primeira renderização continua lá: ele só sai com o cv-defer (ver abaixo).

O primeiro timing (7 repetições, todas as variantes; `fixes/timing/timing_real_7.json`) bate com isso.
Nele, a base sozinha deu 9.9 FPS e pior frame de 400ms.

## O que foi descartado e por quê

| candidato | veredito | motivo |
|---|---|---|
| `offscreen-work-cv-defer` | drop | Com âncora (/#about, /#process) o gradiente do "Zero friction." não faz mais a varredura da baseline. O frame com o alvo embaixo da nav dura 4x mais. Após End + roda do mouse em 1280/1024, o conteúdo pula 5-6px. Aparecem frames em branco no footer com a tecla End. |
| `offscreen-work-cv-defer-warm` | drop (a emenda foi derrubada pelo cético) | Antes do warm-up terminar, o conteúdo pula sozinho, sem input: 6px em 1280 e 15-18px no celular depois de Ctrl+F, e 48px ao girar o celular. **É o maior ganho que existe**: long tasks 1555 para 549ms, pior frame 767 para 250ms (`timing_real_7.json`, variante `cvstay`). Só volta com mais trabalho nas alturas reservadas. |
| `paint-composite-intro-split` | drop | Com a travada, o compositor mostra texto quase opaco e ainda borrado (8-12px), um frame que não existe nem na baseline nem no design. Com a máquina ociosa, o texto também fica sub-pixel deslocado durante a intro. |
| `paint-composite-combined` | drop | Inclui o intro-split. A parte útil dele (stable-layerize) entrou separada. |
| `style-invalidation-pseudo-radius` | drop (no re-vet do patch combinado) | Com raio fixo no `.btn::after`, o texto dos botões ghost ("View Work", "Check Slots", "Commission") fica ~0.25px deslocado depois de hover (desktop) ou toque (celular). Na baseline o hover sempre re-rasteriza na mesma fase. Isolado por bisect e reproduzido por dois céticos. O ganho dele também era pequeno (8.4 para 8.8 FPS). |
| stable-layerize sem emenda | substituído pela versão ≥1440 | Abaixo de ~1280px o `contain` corta o fim da sombra dos cards de preço (faixa de 12-29px, 1-2 níveis de cor). Os anéis transparentes do pulse saíram porque não deram ganho mensurável. |

Fora do escopo desta rodada: os AMENDs antigos (`loading-early-ready`, `loading-font-preload`,
`style-invalidation-boot-freeze-gate`, `loading-combined`, dedupe do `visits.json`).
As emendas deles ainda não foram re-verificadas, por isso não entraram.

## Como foi verificado

- Vetting adversarial de cada candidato, com um cético independente para cada um (`fixes/vet-*/cloud`, `fixes/vet-*/skeptic`).
- Re-vet do patch combinado em três lentes (visual desktop, touch e outras páginas, comportamentos), cada uma com cético (`fixes/combined/vet/`).
  Desktop com Lenis: walks em 1440/1920/1366/1280 e 1440 em DPR 2; intro em 16 instantes; hover, foco e Tab em todos os botões e cards; bordas do `#pricing` até 2560.
  Touch: 390/360/768 e 1024/1100; /tos/, /slots/ e 404; reduced motion; fontes bloqueadas ou atrasadas.
  Comportamentos: âncoras, cliques da nav com Lenis, limite do Lenis, curvas de `--fp` e `--leave`, depoimentos, Discord (40 loads), contador de visitas, lightbox, parallax, rail.
- A versão final (sem pseudo-radius) repetiu os dois checks que derrubaram o pseudo-radius e ficou igual à baseline. O `combined` antigo, usado como controle, continuou diferente.
  Também rodou o visual do bench (o "Yours" escuro em 900ms sai 1/10 nos dois lados), o escopo do `contain` (`fixes/final/vet/`) e o timing de 10 repetições.

## Riscos

- `contain: paint` no `#pricing` (≥1440): um brilho, tooltip ou elemento novo que vaze da seção vai ser cortado na borda dela. Nunca adicione `overflow-clip-margin` (traz o custo de volta).
- `--leave` agora não é herdado e as variáveis da nav moram no `#nav`: CSS novo fora dessas seções que leia essas variáveis vai receber o valor padrão. Nada lê hoje.
- Todos os números são desta máquina. Vale rodar `bench-real.js timing` no seu PC antes de publicar.

## Achados sobre o harness (afetam números antigos)

- O Chromium headless se declara `hover: none`. Com isso o `smooth-scroll.js` não carregava o Lenis e o `script.js` rodava em modo touch.
  Todas as medições e vets anteriores (inclusive a baseline do HANDOFF, se rodou no mesmo modo) foram feitas sem Lenis.
  O `bench-real.js` corrige isso: ponteiro de mouse e Lenis servido de `vendor/`.
- O modo `layers` do `bench.js` não é confiável no Chrome atual.
- O `serve` vaza descritores de arquivo e cai com EMFILE quando o puppeteer aborta requisições.

## Corridas que já existem na baseline (não foram causadas pelo patch)

- `/#testimonials` no celular às vezes para 18px fora do lugar: a transição do reveal corre contra o `go()` de 900ms.
- Com CPU 4x, as colunas de depoimentos congelam em 2 de 3 loads da baseline. Com o patch elas andam em 3 de 3. É mudança de comportamento, mas no sentido de consertar.
- Em loads com âncora, o primeiro frame mostra o alvo embaixo da nav (sem o offset de 80px) até o `go()` rodar.

## Bug da intro do hero

Não foi mexido. A medição foi feita contra o site atual, com a intro quebrada. O custo de restaurar a intro não foi medido.
