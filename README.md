<div align="center">

# s0da

**Roblox thumbnail design portfolio.**
Premium dark / deep red. Built from scratch, no frameworks.

[**Live**](https://dgolaus.github.io/s0da-portfolio/) · [**Terms**](https://dgolaus.github.io/s0da-portfolio/tos.html) · [**Discord**](https://discord.gg/s0da) · [**Twitter**](https://x.com/gfxs0da)

</div>

---

Portfolio site for [@gfxs0da](https://x.com/gfxs0da) — Roblox thumbnail designer
with **2.3B+ visits** influenced. GFX Artist at
[Rubicon Games](https://rubiconstudios.io/) and
[Cube Graphics](https://cubethumbs.com).

## Stack

| Layer | Tech |
|---|---|
| Markup | HTML5 |
| Styles | CSS (custom properties, `:has()`, backdrop-filter, SVG filters) |
| Behavior | Vanilla JS — zero dependencies in the browser |
| Images | WebP optimized via [`sharp`](https://sharp.pixelplumbing.com/) (Node) |
| Type | Inter Tight · Inter · JetBrains Mono |
| Hosting | GitHub Pages |

## Features

- **Cinematic hero** — 5 rows of thumbs scrolling in alternating directions with perspective tilt; staggered fade-in with blur reduction; 3 glass stat cards with `backdrop-filter` SVG distortion
- **Work grid** — multi-variant cards with hover carousel arrows + count badge; click any tile for full lightbox with prev/next + keyboard nav
- **Trust section** — counter-up animation (`2.3B+`, `200+`, `~48h`) + 5 stars that pop in sequence with red glow
- **Process / Discord mock** — animated 9-message ticket conversation with typing indicators, 3D cursor tilt + radial glow on the chat card
- **Pricing** — 4 tiers with hover focus (others blur+darken)
- **Smooth scroll** — lerp-based momentum, frame-rate independent
- **TOS subpage** — sticky table of contents with scroll spy; deep-linkable section anchors
- **Responsive** down to mobile; respects `prefers-reduced-motion`

## Structure

```
.
├── index.html            ← portfolio
├── tos.html              ← terms of service
├── styles.css            ← all styling (~1700 lines, scoped sections)
├── script.js             ← all interactions (smooth scroll, lightbox, chat, tilt, …)
├── optimize-images.js    ← run after dropping new thumbs into assets/work/
├── package.json
└── assets/
    ├── favicon.svg       ← minimalist red ring
    ├── pfp.png
    └── work/
        ├── *.webp        ← served by the site
        └── works.txt     ← thumb metadata reference
```

## Local development

Any static file server works. Open `index.html` directly in a browser too.

```bash
# python
python -m http.server 8000

# node
npx serve
```

## Adding new thumbnails

1. Drop PNG / JPG files into `assets/work/`
2. Run the optimizer (first time: `npm install`):
   ```bash
   node optimize-images.js
   ```
   Outputs `.webp` at quality 85, max 1920px on the long edge.
3. Reference the new `.webp` filename in `index.html` (work grid + hero bg)

## Deploy

`main` is the deploy branch — push and GitHub Pages rebuilds automatically (~30–60s).

```bash
git add .
git commit -m "your message"
git push
```

## License

**All rights reserved.** The source is visible because static sites are
inherently public to any browser, but the design, code, and visuals are
property of @gfxs0da. Not licensed for reuse, redistribution, or as a
template for derivative portfolios.

---

<sub>Designed and built with [Claude Code](https://claude.com/claude-code).</sub>
