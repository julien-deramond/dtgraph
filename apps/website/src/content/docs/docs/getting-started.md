---
title: Getting started
description: Two ways to start using dtgraph — the playground, or the CLI.
sidebar:
  order: 1
---

## Option 1: the playground (no install)

Go to **[the playground](../../)** and drop a DTCG JSON file onto the page (or paste it into the
"Or paste JSON" box). The resolved token graph renders immediately, entirely in your browser —
nothing is uploaded anywhere.

This is the fastest way to check a file you already have open, or to see what dtgraph does
before installing anything.

## Option 2: the CLI

Install the CLI globally with npm:

```sh
npm install --global dtgraph
```

Then validate a token file:

```sh
dtgraph validate tokens.json
```

```
✓ 1 file(s) valid — 4 token(s), 1 edge(s)
```

Or render one to an SVG:

```sh
dtgraph render tokens.json -o graph.svg
```

Both commands accept more than one file — aliases resolve across all of them, so you can split
tokens across `color.json`, `spacing.json`, `typography.json`, etc.:

```sh
dtgraph validate color.json spacing.json typography.json
```

See the **[CLI reference](../cli-reference/)** for every flag and exit code, or
[`packages/cli`](https://github.com/julien-deramond/dtgraph/tree/main/packages/cli) for the
full README and a runnable example.

## New to DTCG?

If you're not sure what a valid token file looks like yet, read the
**[DTCG primer](../dtcg-primer/)** first.
