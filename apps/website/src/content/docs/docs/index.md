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

There are three ways to use it:

- **[The playground](/)** — drop a token file (or paste JSON) in your browser, no install, no
  upload. Best for a quick look at a file you have open.
- **The [`dtgraph` CLI](/docs/cli-reference/)** — `render` a token graph to SVG or `validate`
  token files in CI, from the command line.
- **`@dtgraph/core`** — the parser/resolver/renderer library the playground and CLI are both
  built on, if you're integrating dtgraph into your own tooling.

New to DTCG? Start with the **[DTCG primer](/docs/dtcg-primer/)**. Ready to use dtgraph?
Head to **[Getting started](/docs/getting-started/)**.
