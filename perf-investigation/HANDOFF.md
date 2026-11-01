# Hero entry jank — handoff to the cloud session

Written 2026-11-01 from the user's local session, which stays open. You are a COPY whose only job is to finish
this optimization. The user (@gfxs0da, speaks PT-BR, site is English-only) reviews the result before anything ships.

## Hard rules

1. **Nothing visual may change.** User's words: "melhorar sem remover nada". No effect removed, no animation
   altered, nothing drawn differently at any moment, including mid-intro. A pixel diff above the A/A noise kills
   a fix.
2. **Never push to `main`, never deploy.** GitHub Pages publishes `main`. Work only on branch `perf-investigation`.
   Deliver a report plus one combined patch on this branch; the user decides what ships.
3. **Git identity.** Before your first commit run `git config user.email`. It must be
   `213807894+dgolaus@users.noreply.github.com` with name `dgolaus`. If it is anything else, set it locally. The
   repo is public; the user's real name and email must never appear in a commit.
4. **Measure timing serially.** Parallel browsers on one machine corrupt FPS numbers. Agents may reason in
   parallel, but `bench.js timing` runs from one place, one at a time, variants interleaved.
5. Do not touch the lite mode (`html.lite`) or rely on it. The goal is the FULL experience running smoother.
6. Ask before deciding anything that is a taste call.

## Setup

```bash
npm i                      # repo root: puppeteer, sharp
npx serve -p 5173 . &      # repo root; the bench expects http://localhost:5173
cd perf-investigation
node bench.js timing variants.json 7     # interleaved A/B, median of 7
node bench.js visual variants.json       # freezes all animations at 150/500/900/1400/5000ms and pixel-diffs
node bench.js layers variants.json
node trace.js && node --max-old-space-size=4096 trace-summary.js trace_warm.json
```

`variants.json` = `[{"name":"baseline"}, {"name":"x","files":{"/script.js":"fixes/raf-loops/script.raf-loops.js"}}]`.
Paths in `files` are relative to `perf-investigation/`. **Test CSS fixes by serving a modified `/styles.css` through
`files`, not through the `css` field**: `css` is injected late and adds its own full-document recalc, so CSS fixes
would look worse than they are. The bench blocks lite mode and forces 8 cores / 8 GB so the full site is measured.

Your cloud machine is not the user's PC: re-measure the baseline there and compare only against that baseline.

## Baseline on the user's PC (CPU 4x throttle + software raster, 1440x900)

- ENTRY 0–3.5s: 16 FPS, frame p95 300ms, worst 533ms, 7 frames >50ms, 2.5s lost vs 60fps, ~1.5s of long tasks
- STEADY 3.5–8.5s: 33 FPS, p95 42ms, 0 frames >50ms
- A/A noise: about ±1.5 FPS and ±100ms lost

## What is known (details in `findings.json`: 6 investigations + adversarial verdicts)

Entry jank is **main-thread**, not GPU: ~1.76s of long tasks (Layout ~700ms incl. one 433ms layout, style recalc
~590ms, script.js eval with forced layouts). Raster + decode total ~120ms. Paint is ~37ms (an earlier summary
double-counted nested Paint events). The old "collage rows exceed 8192px texture" claim is false: Chromium tiles.

Causes, roughly by weight:
1. The 433ms first layout is ~65% text shaping of below-the-fold sections. Fix candidate:
   `offscreen-work-cv-defer` / `-warm` (content-visibility:auto + deferring 4 script reads that would force it).
   **Biggest single win, NOT yet vetted. Do this first.** Must keep /#pricing and other anchor loads exact, Lenis
   limit, reveal observers, footer `--fp` math, testimonial loop, no layout shift.
2. script.js writes CSS custom properties on `<html>` with values equal to the defaults → ~1000-element restyle;
   inherited `--leave` on 5 sections → ~660 elements. Found independently by 3 lanes.
3. boot.js `body.classList.add('ready')` restyles everything mid-intro (the "Cloudflare beacon" recalc is this).
4. Testimonial column filler interleaves writes and reads: 3 forced layouts.
5. Per-frame re-layerization (~6ms/frame): price-card float animations + pulse rings changing size.
   Candidate `paint-composite-stable-layerize`, NOT yet vetted.
6. Fonts land mid-intro and force a relayout. 7. `assets/visits.json` is fetched twice per load (dedupe it).

## Vetting state

- APPROVED, pixel diff 0 at all five times: `forced-layout-batch`, `raf-loops-noop-writes`,
  `raf-loops-noop-writes-plus-leave`, `raf-loops-leave-noinherit`. These overlap (same hunks in script.js,
  same `@property --leave` in styles.css): combine into ONE version, plus forced-layout's unique testimonial-filler
  batching (script.js ~1257-1274).
- AMEND (see verdicts): `loading-early-ready`, `loading-font-preload` (hardcoded Google woff2 URLs only match desktop
  Chromium: do not ship them), `style-invalidation-*`.
- CAUGHT BREAKAGE, do not ship as-is: `loading-combined` left the Discord ticket mockup empty on /#process (3/10
  loads) and froze testimonial columns on /#testimonials (7/10) by exposing a race near script.js:641.
- NOT YET VETTED: `offscreen-work-cv-defer`, `offscreen-work-cv-defer-warm`, `paint-composite-stable-layerize`,
  `paint-composite-intro-split`, `paint-composite-combined`, `style-invalidation-pseudo-radius`.

## Plan

1. Vet the 6 unvetted candidates adversarially (try to prove they change pixels or break a behaviour; open
   /#pricing, /#process, /#testimonials directly, scroll everything, mobile 390px, reduced motion, /tos/, /slots/).
2. Serial timing: baseline vs each survivor, 7+ reps interleaved.
3. Build ONE combined patch from the winners, then re-vet the combined version the same way and time it.
4. Report: before/after numbers, what was dropped and why, risks. Commit the patch to this branch only.

## Do not fix on your own: the hero intro bug

`styles.css:3607`: the `HERO INTRO` comment lost its opening `/*` in the 2026-09-20 redesign merge (an off-by-one
in the merge script). The selector becomes invalid and `.hero-inner { animation: heroBlockIn ... }` is dropped:
computed `animation-name` is `none`. The redesign's whole-hero zoom+blur intro has **never run live**. Restoring it
is a one-line fix but it CHANGES what visitors see and ADDS jank (a blur over the entire hero). The user doesn't
remember the animation and wants to see both versions side by side before deciding. Leave it as is; measure your
fixes against the current (broken-intro) site, and optionally report what restoring it would cost.

## Known behaviour that must keep working

Anchor landing on load (`/#pricing` etc., handled at the top of script.js; Lenis numeric scrollTo in
smooth-scroll.js); live visits counter (`data-live="visits"` reading `influenced` from visits.json); Discord ticket
loop in Process; reveal-on-scroll observers; cinematic footer `--fp`; 3-column testimonial scroll; reduced motion;
mobile layout; hero pointer parallax; card variant arrows and lightbox; /tos/ scroll spy; /slots/ and 404 pages.
