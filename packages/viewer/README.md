# @dtgraph/viewer

An interactive, WebGL-rendered map of a [DTCG](https://www.designtokens.org/tr/2025.10/format/)
token graph. Tokens cluster by what they reference, are sized by how many tokens depend on
them, and are labeled progressively as you zoom. Hover a token to spotlight what it relates to,
click it for details, search to jump anywhere. Built on [`@dtgraph/core`](../core#readme),
[Sigma.js](https://www.sigmajs.org/) and [graphology](https://graphology.github.io/).

Framework-agnostic: one mount function, one container element, no React required. It powers the
[playground](https://julien-deramond.github.io/dtgraph/), the
[Storybook addon](../storybook#readme) and the [`<TokenGraph interactive />`](../mdx#readme) MDX
component.

## Install

```sh
npm install @dtgraph/viewer @dtgraph/core
```

## Usage

```ts
import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import { mountTokenGraphViewer } from '@dtgraph/viewer';
import '@dtgraph/viewer/style.css';

const tree = parseTokenTree(tokensJson);
const named = [{ source: 'tokens.json', tree }];
const graph = buildTokenGraph(flattenTokenTree(tree), resolveAliasEdgesAcrossFiles(named));

const viewer = mountTokenGraphViewer(document.getElementById('map'), graph, { theme: 'dark' });

// later
viewer.select(['color', 'brand']);
viewer.fit();
viewer.destroy();
```

The container must have a non-zero width and height (give it a height), and the browser needs
WebGL. If either is missing, `mountTokenGraphViewer` throws an error that says so and leaves the
container untouched.

If your host cannot import CSS files (Storybook's manager, a plain `<script>` tag, ...), inject
the stylesheet instead:

```ts
import { injectViewerStyles } from '@dtgraph/viewer';

injectViewerStyles(); // idempotent; adds one <style id="dtgraph-viewer-styles"> to <head>
```

## Options

| Option     | Type                                   | Default   | Description                                                                              |
| ---------- | -------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `theme`    | `'dark' \| 'light'` or colors          | `'dark'`  | Canvas and overlay colors. See [Theming](#theming) for your own palette.                 |
| `colorBy`  | `'group' \| 'type'`                    | `'group'` | Color tokens by top-level group (`color.*`, `button.*`, ...) or by DTCG `$type`.        |
| `chrome`   | `boolean`                              | `true`    | Show the search box, legend and detail panel. `false` gives the bare map.               |
| `layout`   | `{ iterations?, settings? }`           |           | ForceAtlas2 iteration count and setting overrides, for graphs above the small threshold. |
| `onSelect` | `(token: TokenNode \| undefined) => void` |        | Called whenever the selection changes.                                                   |

## Handle

`mountTokenGraphViewer` returns:

| Member             | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| `select(path)`     | Select a token (dotted path or segments): spotlight its chains, open its details.   |
| `clearSelection()` | Clear the selection and close the panel.                                             |
| `selected`         | The selected token's dotted path, or `undefined`.                                    |
| `zoomTo(path)`     | Animate the camera onto a token.                                                     |
| `fit()`            | Animate the camera back to the whole graph.                                          |
| `toSvg(options?)`  | The map as a standalone SVG string (see [Export](#export)).                           |
| `destroy()`        | Tear down the renderer and remove everything the viewer added to the container.     |
| `graph`, `sigma`   | The laid-out graphology graph and the Sigma instance — escape hatches for extension. |

## Interaction

- **Drag** to pan, **scroll / pinch** to zoom, **double-click** a token to dive onto it.
- **Hover** a token: it and its direct neighbors stay lit and labeled, everything else fades.
- **Click** a token: its whole upstream chain (what it resolves through) and downstream set
  (everything that changes if it changes) stay lit; the detail panel shows type, group, source
  file, description, the raw `$value`, what it resolves to (with a swatch for colors), and
  clickable "Depends on" / "Used by" lists. Click the background or press `Esc` to clear.
- **Legend**: click a group or type to show only it; click again to clear.
- **Keyboard**: `/` or `Ctrl`/`Cmd`+`K` focuses search (arrows + `Enter` pick a result), `Esc`
  clears, `f` fits.

## Export

`viewer.toSvg()` serializes the map to a standalone SVG string: the same layout positions, the
same palette colors, the same blast-radius dot sizes and the same faded edge texture, framed the
way `fit()` frames it, in the viewer's theme.

```ts
const svg = viewer.toSvg({ width: 1600, theme: 'light' });
```

| Option       | Type                          | Default  | Description                                                  |
| ------------ | ----------------------------- | -------- | ------------------------------------------------------------ |
| `width`      | `number`                      | `1200`   | Image width in pixels; the height follows the graph's shape. |
| `theme`      | `'dark' \| 'light'` or colors | mounted  | Overrides the viewer's own theme.                            |
| `padding`    | `number`                      | `48`     | Breathing room around the graph, in pixels.                  |
| `labels`     | `'auto' \| 'all' \| 'none'`  | `'auto'` | `auto` thins labels through the same grid the canvas uses.   |
| `background` | `boolean`                     | `true`   | Paint the theme's background behind the graph.               |
| `emphasis`   | `ExportEmphasis`              | current  | What the file spotlights (see below).                        |

### What the file spotlights

`viewer.toSvg()` exports the map as it stands: select a token and the file has that token ringed,
its upstream chain and its blast radius lit and labelled, everything else faded the way the canvas
fades it; solo a legend group and the file shows that group alone. Pass `emphasis` to override it,
or `{ emphasis: {} }` for the map at rest.

```ts
viewer.select('color.brand.primary');
const focused = viewer.toSvg(); // the selection, its chains, the rest faded
const atRest = viewer.toSvg({ emphasis: {} }); // every token at full strength
```

| Field        | Type                       | Description                                                          |
| ------------ | -------------------------- | -------------------------------------------------------------------- |
| `selected`   | `string \| null`           | The token in the spotlight; its chains are walked for you.           |
| `hovered`    | `string \| null`           | Spotlight one token's direct neighbors only; outranks `selected`.    |
| `solo`       | `string \| null`           | Show one category alone.                                             |
| `categoryOf` | `(node: string) => string` | Which category a token is in. Defaults to its group.                 |

The camera is still out of it: the file is the whole map, framed the way `fit()` frames it, never
the region you had zoomed into. So is the chrome (search, legend, detail panel). Dot and label
sizes are in pixels, as on the canvas, so a wider export shows a wider map rather than a magnified
one.

Without a mounted viewer, `renderViewerGraphToSvg(graph, options)` takes any graph you have built
and laid out yourself:

```ts
import { buildViewerGraph, layoutViewerGraph, renderViewerGraphToSvg } from '@dtgraph/viewer';

const graph = buildViewerGraph(tokenGraph);
layoutViewerGraph(graph);
const svg = renderViewerGraphToSvg(graph, { theme: 'dark' });
```

`renderTokenGraphToSvg` in [`@dtgraph/core`](../core#readme) is a different picture for a
different job: a dependency-free list rendering, one row per token, with no layout step. That is
what the CLI's `dtgraph render` and `<TokenGraph />` in static mode write.

## Where it is running

The viewer is as often a 480px box inside a docs page as it is a whole phone screen, and a wide
desktop can hold both at once — so it adapts to **its container**, not to the viewport, and
handles input as a separate question from size. None of this needs an option.

**Its container.** Below 560px wide the chrome folds: the search box takes the top edge with the
legend collapsed into a pill beside it, and the detail panel comes up from the bottom as a sheet
instead of taking a side rail that would leave no map. Selecting a token then aims the camera at
the space above the sheet, so what you picked is not underneath it. Every overlay is capped in
`cqh`, so a short container gets short lists rather than lists sized to a screen it cannot see.
This is `@container` and `container-type: size` — Chrome 105, Safari 16, Firefox 110.

**Touch.** Rows, legend entries and buttons grow to 44px, the search field to 16px (anything
smaller and iOS Safari zooms the page into it), token dots grow enough to be worth aiming at, and
the `/` badge disappears where there is no keyboard. Hover states are behind `@media (hover:
hover)`, with a pressed state in their place.

**Scrolling past an embedded map.** On a touchscreen a map that keeps every gesture is a trap
inside someone else's article. So a viewer that does not fill the screen starts passive — the page
scrolls straight through it — behind a "Tap to explore" affordance; tapping hands gestures to the
map until you tap "Done" or scroll it out of view. A viewer that does fill the screen has no page
to scroll and never asks. This is the one piece of chrome `chrome: false` does not remove.

**Elsewhere.** The camera stops travelling under `prefers-reduced-motion`, the chrome clears the
notch and the home indicator when the viewer owns the screen, panel text stays selectable so a
`$value` can be copied, and the panel and its lists scroll under a finger without panning the map.

## How it reads

- **Size** is blast radius: a square-root scale of how many tokens depend on a token, directly
  or transitively. Heavily-used primitives are the big dots.
- **Color** is the top-level group by default (or `$type`), from a 20-hue palette tuned for
  each theme; edges take their source token's color.
- **Layout** is deterministic. Up to 24 tokens: a layered diagram, primitives on the left and
  each consumer one column right of the deepest token it references. Larger graphs: ForceAtlas2
  (LinLog, size-aware) so tokens that reference each other cluster, with tokens that reference
  nothing packed into one small satellite disc per group around the core.
- A token's effective `$type` follows its alias chain, so `{semantic.primary}`-style tokens
  color and filter as `color` even without repeating `$type`.

## Theming

Overlay colors are CSS custom properties on `.dtgraph-viewer` (see `style.css`):
`--dtgraph-viewer-bg`, `--dtgraph-viewer-fg`, `--dtgraph-viewer-font`,
`--dtgraph-viewer-radius`, and the `--dtgraph-viewer-panel-*` / `--dtgraph-viewer-accent` /
`--dtgraph-viewer-code-bg` / `--dtgraph-viewer-shadow` set for panels. Layout has two knobs too:
`--dtgraph-viewer-gutter` (how far the chrome sits from the container edge, 12px) and
`--dtgraph-viewer-legend-width` (what the collapsed legend takes in the narrow composition, and
what the search box leaves clear for it). The canvas itself is painted from `THEMES` in
`theme.ts`, exported for hosts that want to match it.

The canvas is WebGL, so CSS can't reach it: pass your own colors as `theme` instead. It takes a
whole `ThemeColors`, the same shape `toSvg()` accepts, so start from a built-in one and replace
what you need — the categorical `palette` for the dots, `background`, `label`, `labelHalo`,
`hoverRing`:

```ts
import { mountTokenGraphViewer, THEMES } from '@dtgraph/viewer';

mountTokenGraphViewer(container, graph, {
  theme: { ...THEMES.dark, background: '#0a0c11', palette: ['#3ab9bf', '#83acef', '#c78fef'] },
});
```

Use hex colors: faded dots and edges are mixed toward `background` on the CPU, and only
`#rrggbb` mixes. The container then carries `data-theme="custom"` and keeps the dark chrome
defaults; retheme the chrome with the custom properties above. `toSvg()` exports in the same
colors.

The viewer also sets two attributes on the container that CSS and hosts can read:
`data-full-bleed` (`"true"` when it covers the viewport) and `data-gesture`
(`"map"` when it owns gestures, `"page"` while the page does, `"held"` after a tap handed them
over).

## Security model

Token content is untrusted input. The viewer draws token text only through canvas `fillText`
(labels) and builds every panel, result row and chip from DOM nodes with `textContent` — no HTML
is ever built from token content, the same guarantee as `renderTokenGraphToSvg` in core. The SVG
export escapes every piece of token-derived text before it reaches the markup, so it is safe to
call on files you did not write.

## Examples

- The [playground](https://julien-deramond.github.io/dtgraph/) — drop your own token files.
- [`examples/storybook`](../../examples/storybook) — the addon panel.
- [`examples/mdx-astro`](../../examples/mdx-astro) — `<TokenGraph interactive />`.
