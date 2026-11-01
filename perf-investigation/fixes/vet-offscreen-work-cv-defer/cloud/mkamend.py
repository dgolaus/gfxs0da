# Builds the amended scripts from the candidate files (candidate files are not modified).
#  A1 (gradient): when a deferred accent goes live, seed its smoothed value with the target at the
#     scroll position of the LAST painted frame, i.e. the value the baseline loop holds at rest.
#     A jump that follows (anchor load, native anchor click on touch) then sweeps exactly like baseline.
#  A2 (hash loads): arriving with a #hash that names an element, every deferred section is rendered from
#     the start (inline content-visibility: visible) until load + 1s, so the browser's own fragment scroll
#     and go() see the same page and timing as the baseline. Then they go back to auto (exact heights).
import sys, io
SRC = '/home/user/gfxs0da/perf-investigation/fixes/offscreen-work/'
OUT = '/home/user/gfxs0da/perf-investigation/fixes/vet-offscreen-work-cv-defer/cloud/'

def rep(s, old, new):
    assert s.count(old) == 1, old[:60]
    return s.replace(old, new)

A1_OLD = "    const on = () => live.add(el);\n"
A1_NEW = ("    const on = () => {\n"
          "      if (live.has(el)) return;\n"
          "      live.add(el);\n"
          "      // Parado, o loop original já guardava o alvo da posição do último\n"
          "      // quadro: semeia esse valor, e um pulo logo em seguida (âncora no\n"
          "      // load, clique nativo no touch) varre o gradiente como antes.\n"
          "      const vh = window.innerHeight;\n"
          "      if (vh && cvOn) smoothed.set(el, 50 - ((el.getBoundingClientRect().top + window.scrollY - lastY) / vh) * 100);\n"
          "    };\n")
LOOP_OLD = "  function loop() {\n    update();\n    requestAnimationFrame(loop);\n  }\n  requestAnimationFrame(loop);\n})();\n\n/* 6d."
LOOP_NEW = "  function loop() {\n    update();\n    lastY = window.scrollY;\n    requestAnimationFrame(loop);\n  }\n  requestAnimationFrame(loop);\n})();\n\n/* 6d."
LIVE_OLD = "  const live = new Set();\n"
LIVE_NEW = "  const live = new Set();\n  let lastY = window.scrollY;   // scroll do último quadro desenhado\n"

A2_ANCHOR = "// Links internos (#pricing…) em qualquer aparelho, com ou sem Lenis: as\n"
A2_NEW = ("// Chegando com #secao (ex.: /#pricing): renderiza tudo desde o início,\n"
          "// e as inits adiadas rodam na hora (cvWhenNear),\n"
          "// como antes, até load + 1s (depois dos reajustes do go()). Assim o\n"
          "// pulo do próprio navegador e o go() veem a mesma página e o mesmo\n"
          "// tempo de antes. Depois voltam ao auto, já com as alturas reais.\n"
          "const cvHash = cvOn && !!hashTarget();\n"
          "if (cvHash) {\n"
          "  cvExactWidth = window.innerWidth;\n"
          "  cvSections.forEach((s) => { s.style.contentVisibility = 'visible'; });\n"
          "  const back = () => setTimeout(() => requestAnimationFrame(() => {\n"
          "    if (cvExactWidth === window.innerWidth) cvSections.forEach((s) => { s.style.contentVisibility = ''; });\n"
          "  }), 1000);\n"
          "  if (document.readyState === 'complete') back();\n"
          "  else window.addEventListener('load', back, { once: true });\n"
          "}\n\n")

WN_OLD = "  if (!cvOn || !section || !cvSections.includes(section)) { fn(); return; }\n"
WN_NEW = "  if (!cvOn || cvHash || !section || !cvSections.includes(section)) { fn(); return; }\n"
for name in ['c1', 'c2']:
    s = io.open(SRC + 'script.%s.js' % name, encoding='utf-8', newline='').read()
    crlf = '\r\n' in s
    if crlf: s = s.replace('\r\n', '\n')
    g = rep(s, A1_OLD, A1_NEW); g = rep(g, LOOP_OLD, LOOP_NEW); g = rep(g, LIVE_OLD, LIVE_NEW)
    h = rep(g, A2_ANCHOR, A2_NEW + A2_ANCHOR)
    h = rep(h, WN_OLD, WN_NEW)
    for suf, txt in (('g', g), ('gh', h)):
        if crlf: txt = txt.replace('\n', '\r\n')
        io.open(OUT + 'script.%s%s.js' % (name, suf), 'w', encoding='utf-8', newline='').write(txt)
        print('wrote', OUT + 'script.%s%s.js' % (name, suf), 'crlf' if crlf else 'lf')
