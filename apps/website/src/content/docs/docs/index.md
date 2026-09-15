---
title: dtgraph docs
description: Documentation for dtgraph — render and validate DTCG token graphs.
sidebar:
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
  token files in CI, from the command line.
- **In your docs or Storybook** — `@dtgraph/mdx`'s `<TokenGraph>` component embeds a graph
  (static or interactive) in MDX/Astro pages; `@dtgraph/storybook` adds a panel showing each
  story's tokens.
- **`@dtgraph/core` and `@dtgraph/viewer`** — the parser/resolver library and the map renderer
  everything above is built on, if you're integrating dtgraph into your own tooling.

New to DTCG? Start with the **[DTCG primer](dtcg-primer/)**. Ready to use dtgraph?
Head to **[Getting started](getting-started/)**.
