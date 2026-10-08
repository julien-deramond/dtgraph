---
title: dtgraph docs
description: Documentation for dtgraph — render and validate DTCG token graphs.
order: 0
label: Overview
---

dtgraph turns [DTCG](https://www.designtokens.org/tr/2025.10/format/) design token files into
a visible token graph — nodes for every token, edges for every alias — and helps you catch
problems (dangling aliases, cycles, malformed files) before they reach production.

There are several ways to use it:

- **[The playground](../)** — drop a token file (or paste JSON) in your browser, no install, no
  upload, and explore it on the **[interactive map](viewer/)**: clusters, blast radius, search,
  a detail panel for every token.
- **The [`dtgraph` CLI](cli-reference/)** — `render` a token graph to SVG or `validate`
  token files in CI, from the command line. Both understand
  [DTCG resolver files](cli-reference/#resolver-files), so a light/dark design system can be
  checked per context.
- **In your docs or Storybook** — `@dtgraph/mdx`'s `<TokenGraph>` component embeds a graph
  (static or interactive) in MDX/Astro pages; `@dtgraph/storybook` adds a panel showing each
  story's tokens.
- **`@dtgraph/core` and `@dtgraph/viewer`** — the parser/resolver library and the map renderer
  everything above is built on, if you're integrating dtgraph into your own tooling.

All of them read a token file the same way: `@dtgraph/core` parses and resolves it once, and the CLI and the viewer build on that graph.

<figure class="dg" id="dg-packages">
  <div class="dg__scroll">
    <svg viewBox="0 0 720 224" role="img" aria-labelledby="dg-packages-t dg-packages-d">
      <title id="dg-packages-t">How a token file becomes an SVG or an interactive map</title>
      <desc id="dg-packages-d">A DTCG token file is parsed and resolved by @dtgraph/core into a token graph. The dtgraph command line tool renders that graph to an SVG file. @dtgraph/viewer draws it as an interactive map. @dtgraph/mdx and @dtgraph/storybook build on the same two libraries.</desc>
      <defs>
        <marker id="dg-packages-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 Z" class="dg-head" />
        </marker>
      </defs>
      <text class="dg-title" x="16" y="28"><tspan class="dg-num">01</tspan> Input</text>
      <text class="dg-title" x="186" y="28"><tspan class="dg-num">02</tspan> Parse</text>
      <text class="dg-title" x="372" y="28"><tspan class="dg-num">03</tspan> Package</text>
      <text class="dg-title" x="574" y="28"><tspan class="dg-num">04</tspan> Output</text>
      <g class="dg-node"><rect x="16" y="92" width="120" height="48" /><text class="dg-code" x="76" y="116">tokens.json</text></g>
      <g class="dg-node"><rect x="186" y="92" width="136" height="48" /><text class="dg-code" x="254" y="116">@dtgraph/core</text></g>
      <g class="dg-node"><rect x="372" y="56" width="152" height="48" /><text class="dg-code" x="448" y="80">dtgraph render</text></g>
      <g class="dg-node"><rect x="372" y="128" width="152" height="48" /><text class="dg-code" x="448" y="152">@dtgraph/viewer</text></g>
      <g class="dg-node"><rect x="574" y="56" width="128" height="48" /><text class="dg-text" x="638" y="80">SVG file</text></g>
      <g class="dg-node"><rect x="574" y="128" width="128" height="48" /><text class="dg-text" x="638" y="152">Interactive map</text></g>
      <path class="dg-edge" d="M136,116 H184" pathLength="1" marker-end="url(#dg-packages-arrow)" />
      <path class="dg-edge" d="M322,116 H347 V80 H370" pathLength="1" marker-end="url(#dg-packages-arrow)" />
      <path class="dg-edge" d="M322,116 H347 V152 H370" pathLength="1" marker-end="url(#dg-packages-arrow)" />
      <path class="dg-edge" d="M524,80 H572" pathLength="1" marker-end="url(#dg-packages-arrow)" />
      <path class="dg-edge" d="M524,152 H572" pathLength="1" marker-end="url(#dg-packages-arrow)" />
      <text class="dg-note" x="16" y="208">@dtgraph/mdx and @dtgraph/storybook build on the same two libraries.</text>
    </svg>
  </div>
  <figcaption>Figure 1 · a token file is parsed once by @dtgraph/core; the CLI and the viewer each build on it.</figcaption>
</figure>
<style>
  #dg-packages { margin: var(--space-6) 0; border: var(--stroke-hairline) solid var(--color-line); background: var(--color-bg); }
  #dg-packages .dg__scroll { overflow-x: auto; }
  #dg-packages svg { display: block; width: 100%; height: auto; min-width: 655px; }
  #dg-packages figcaption { padding: var(--space-2) var(--space-3); border-top: var(--stroke-hairline) solid var(--color-line); font: var(--font-size-xs) / var(--font-line-height-body) var(--font-family-mono); color: var(--color-muted); }
  #dg-packages .dg-node rect { fill: var(--color-panel); stroke: var(--color-line); stroke-width: 1; }
  #dg-packages .dg-code, #dg-packages .dg-text { fill: var(--color-fg); text-anchor: middle; dominant-baseline: middle; }
  #dg-packages .dg-code { font: var(--font-weight-regular) 13px var(--font-family-mono); }
  #dg-packages .dg-text { font: var(--font-weight-regular) 14px var(--font-family-body); }
  #dg-packages .dg-title { font: var(--font-weight-semibold) 11px var(--font-family-display); letter-spacing: var(--font-letter-spacing-eyebrow); text-transform: uppercase; fill: var(--color-muted); }
  #dg-packages .dg-num { font-family: var(--font-family-mono); fill: var(--color-primary); }
  #dg-packages .dg-note { font: 12px var(--font-family-body); fill: var(--color-muted); }
  #dg-packages .dg-edge { fill: none; stroke: var(--color-primary); stroke-width: 1.5; }
  #dg-packages .dg-head { fill: var(--color-primary); }
</style>

New to DTCG? Start with the **[DTCG primer](dtcg-primer/)**. Ready to use dtgraph?
Head to **[Getting started](getting-started/)**.
