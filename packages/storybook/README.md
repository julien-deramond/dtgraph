# @dtgraph/storybook

A Storybook addon panel that renders a story's [DTCG](https://www.designtokens.org/tr/2025.10/format/)
token graph, live, next to Controls/Actions: an interactive map you can pan, zoom, search and
click through, with a detail panel for each token. Built on [`@dtgraph/core`](../core#readme)
and [`@dtgraph/viewer`](../viewer#readme).

## Install

```sh
npm install --save-dev @dtgraph/storybook
```

Requires `storybook@^10.0.0`. Add it to your `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite'; // or your framework of choice

const config: StorybookConfig = {
  // ...
  addons: ['@dtgraph/storybook'],
};

export default config;
```

The addon is framework-agnostic — it only reads story parameters and renders into its own panel,
so it works with any Storybook framework (React, Vue, Angular, Svelte, web components, plain
HTML, ...). The panel follows Storybook's light/dark theme.

## Story parameter API

Declare a story's tokens via the `dtgraph` parameter:

```ts
export const Primary: Story = {
  parameters: {
    dtgraph: {
      tokens: {
        color: {
          brand: { $type: 'color', $value: '#3311ff' },
          accent: { $value: '{color.brand}' },
        },
      },
    },
  },
};
```

`tokens` can also be an array of documents — each entry is treated like a separate file, and
aliases resolve across all of them, the same as the `dtgraph` CLI's multi-file support:

```ts
parameters: {
  dtgraph: {
    tokens: [colorTokens, typographyTokens],
  },
}
```

The map follows the manager's light/dark theme. To force one, or to paint it in your own colors
(a `ThemeColors` from [`@dtgraph/viewer`](../viewer#theming)), set `theme` once in
`.storybook/preview`; Storybook merges it with each story's `tokens`:

```ts
import { THEMES } from '@dtgraph/viewer';

export default {
  parameters: {
    dtgraph: { theme: { ...THEMES.dark, palette: ['#3ab9bf', '#83acef', '#c78fef'] } },
  },
};
```

The panel's search box, legend and detail panel are themed with the viewer's
`--dtgraph-viewer-*` custom properties, which a `managerHead` style can set.

There's no `file`/`files` option (unlike [`<TokenGraph>`](../mdx#readme)): the panel runs in
Storybook's manager UI, a browser context with no filesystem access, so tokens must already be
in-memory JS values — typically imported from a `.json` file at the top of your stories file:

```ts
import colorTokens from './color.tokens.json';
```

A story with no `dtgraph` parameter shows a placeholder instead of an empty panel. Errors
(malformed tokens, a dangling alias, an alias cycle, a cross-document token-path collision) show
the same message `@dtgraph/core` itself throws — nothing is re-wrapped.

## Example

See [`examples/storybook`](../../examples/storybook) for a minimal runnable Storybook project
using this addon.
