# @dtgraph/mdx

A `<TokenGraph>` Astro component that renders a live [DTCG](https://www.designtokens.org/tr/2025.10/format/)
token graph inline — in MDX content, or in a plain `.astro` file — as a static SVG, or as an
interactive map you can pan, zoom, search and click through. Built on
[`@dtgraph/core`](../core#readme) and [`@dtgraph/viewer`](../viewer#readme).

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

## Interactive mode

Add `interactive` to get the `@dtgraph/viewer` map instead of the static SVG: a WebGL canvas
you can drag, zoom, hover (spotlights everything a token relates to), click (opens a detail
panel with the raw and resolved value, and what depends on what), and search (`/`). The graph
is still parsed and resolved at build time; only the resolved nodes and edges ship to the
browser, as a JSON payload the component hydrates on load.

```mdx
<TokenGraph file="src/tokens.json" interactive height="360px" />
```

The map follows your site's theme: `<html data-theme="dark|light">` when present (Starlight
sets it), else `prefers-color-scheme`, live. Force one with `theme="dark"` or `theme="light"`,
or pass your own canvas colors, a `ThemeColors` from `@dtgraph/viewer`:
`theme={{ ...THEMES.dark, palette: ['#3ab9bf', '#83acef'] }}` (see the viewer's
[Theming](https://github.com/julien-deramond/dtgraph/tree/main/packages/viewer#theming)).

## Props

| Prop          | Type                          | Description                                                                                                              |
| ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `tokens`      | `unknown`                     | Inline DTCG JSON (already parsed) — for a single-file graph.                                                             |
| `file`        | `string`                      | Path to a DTCG JSON file, read via `node:fs` at build time, relative to the current working directory (see above).      |
| `files`       | `string[]`                    | Multiple file paths (see `file`) — aliases resolve across all of them, same as the `dtgraph` CLI's multi-file support. |
| `interactive` | `boolean`                     | Render the interactive map instead of the static SVG. Defaults to `false`.                                              |
| `height`      | `string`                      | Interactive only: CSS height of the map. Defaults to `"480px"`.                                                          |
| `theme`       | `"auto" \| "dark" \| "light"` or colors | Interactive only: follow the site (default), force a theme, or pass your own canvas colors (`ThemeColors`).         |
| `colorBy`     | `"group" \| "type"`           | Interactive only: color tokens by top-level group (default) or by `$type`.                                              |
| `chrome`      | `boolean`                     | Interactive only: show the search box, legend and detail panel. Defaults to `true`.                                     |

Pass exactly one of `tokens`, `file`, or `files`. Errors (malformed JSON, a dangling alias, an
alias cycle, a cross-file token-path collision) throw the same `DtcgParseError` `@dtgraph/core`
itself throws — nothing is re-wrapped, so the message always includes the offending token path
and a link to the relevant part of the DTCG spec.

The rendered SVG is safe to embed as-is: `renderTokenGraphToSvg` (from `@dtgraph/core`) escapes
every piece of token-derived text before this component injects it, even if the source token
file is untrusted. In interactive mode the JSON payload escapes `<` (so no token text can close
its `<script type="application/json">` element) and the viewer only ever draws token text on a
canvas or sets it as `textContent`.

## Example

See [`examples/mdx-astro`](../../examples/mdx-astro) for a minimal runnable Astro + MDX project
using this component, or [`apps/website`](../../apps/website)'s own
[DTCG primer](../../apps/website/src/content/docs/dtcg-primer.mdx) page for a real
dogfooded example (two live `<TokenGraph>` embeds explaining aliases and composite tokens).
