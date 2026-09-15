# @dtgraph/mdx

A `<TokenGraph>` Astro component that renders a live [DTCG](https://www.designtokens.org/tr/2025.10/format/)
token graph inline — in MDX content, or in a plain `.astro` file. Built on
[`@dtgraph/core`](../core#readme).

## Install

```sh
npm install @dtgraph/mdx @dtgraph/core
```

Requires an [Astro](https://astro.build) project (`astro` is a peer dependency, `>=5.0.0`). To
use it from `.mdx` files, also install and configure
[`@astrojs/mdx`](https://docs.astro.build/en/guides/integrations-guide/mdx/).

## Usage

```mdx
import TokenGraph from '@dtgraph/mdx/TokenGraph.astro';

<TokenGraph
  tokens={{
    color: {
      brand: { $type: 'color', $value: '#3311ff' },
      accent: { $value: '{color.brand}' },
    },
  }}
/>
```

Or read one or more token files from disk at build time, as a path relative to the current
working directory (typically the project root — the directory `astro dev`/`astro build` runs
from):

```mdx
<TokenGraph file="src/tokens.json" />
<TokenGraph files={['src/color.json', 'src/typography.json']} />
```

A path relative to the importing file itself (e.g. via `import.meta.url`) is **not** reliable
here — Astro bundles and relocates frontmatter scripts at build time, which breaks paths
resolved that way in the production build even though they may appear to work in `astro dev`.

## Props

| Prop     | Type       | Description                                                                                                              |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `tokens` | `unknown`  | Inline DTCG JSON (already parsed) — for a single-file graph.                                                             |
| `file`   | `string`   | Path to a DTCG JSON file, read via `node:fs` at build time, relative to the current working directory (see above).      |
| `files`  | `string[]` | Multiple file paths (see `file`) — aliases resolve across all of them, same as the `dtgraph` CLI's multi-file support. |

Pass exactly one of `tokens`, `file`, or `files`. Errors (malformed JSON, a dangling alias, an
alias cycle, a cross-file token-path collision) throw the same `DtcgParseError` `@dtgraph/core`
itself throws — nothing is re-wrapped, so the message always includes the offending token path
and a link to the relevant part of the DTCG spec.

The rendered SVG is safe to embed as-is: `renderTokenGraphToSvg` (from `@dtgraph/core`) escapes
every piece of token-derived text before this component injects it, even if the source token
file is untrusted.

## Example

See [`examples/mdx-astro`](../../examples/mdx-astro) for a minimal runnable Astro + MDX project
using this component, or [`apps/website`](../../apps/website)'s own
[DTCG primer](../../apps/website/src/content/docs/docs/dtcg-primer.mdx) page for a real
dogfooded example (two live `<TokenGraph>` embeds explaining aliases and composite tokens).
