# resolver-themes example

A design system split the way the [DTCG Resolver Module](https://www.designtokens.org/tr/2025.10/resolver/)
describes: a `ds.resolver.json` that composes a base palette, a `theme` modifier with `light`
and `dark` contexts, and a components file whose aliases (`{semantic.bg}`) only resolve once a
theme has been picked.

```
ds.resolver.json   sets: base, components · modifier: theme (light | dark, default light)
base.json          color.* primitives, semantic.accent
themes/light.json  semantic.bg / semantic.fg for the light theme
themes/dark.json   semantic.bg / semantic.fg (and an overriding semantic.accent) for the dark theme
components.json    button.* aliasing semantic.*
```

## Try it

From the repo root, after `pnpm install` and `pnpm run build`, pass the resolver **and** every
token file it references. dtgraph detects the resolver, follows its `resolutionOrder`, and picks
each modifier's default context unless `--context` says otherwise:

```sh
node packages/cli/dist/cli.js validate examples/resolver-themes/ds.resolver.json examples/resolver-themes/*.json examples/resolver-themes/themes/*.json
node packages/cli/dist/cli.js validate examples/resolver-themes/ds.resolver.json examples/resolver-themes/*.json examples/resolver-themes/themes/*.json --context theme=dark
node packages/cli/dist/cli.js render examples/resolver-themes/ds.resolver.json examples/resolver-themes/*.json examples/resolver-themes/themes/*.json -c theme=dark -o dark.svg
```

Or, once `dtgraph` is installed globally (see [`packages/cli`](../../packages/cli)):

```sh
dtgraph validate ds.resolver.json *.json themes/*.json --context theme=dark
```

Passing the same token files **without** the resolver fails: `light.json` and `dark.json` both
define `semantic.bg`, and without a resolver every file is merged into one strict token space.
With the resolver, the selected theme's tokens override earlier ones instead.

You can also drop all five files onto the [playground](https://julien-deramond.github.io/dtgraph/):
it shows a selector per modifier so you can switch between `light` and `dark`.
