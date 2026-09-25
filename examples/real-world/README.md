# real-world example

dtgraph on a token set that ships: [`@deramond.dev/tokens`](https://www.npmjs.com/package/@deramond.dev/tokens),
the tokens the [dtgraph website](https://julien-deramond.github.io/dtgraph/) is styled with. It is
a DTCG resolver (`brand.resolver.json`, one set, no modifiers) over eight token files: colour
primitives, semantic colours aliasing them, typography, space, radius, border, layout and motion.

The playground loads the same files under **This site's tokens**.

## Try it

From the repo root, after `pnpm install` and `pnpm run build`:

```sh
pnpm --filter examples-real-world test
pnpm --filter examples-real-world render
```

`test` runs `dtgraph validate` on the resolver and every file it references, and is part of
`pnpm test`, so CI catches a release of the token set that dtgraph cannot read. `render` writes
`graph.svg` next to this README.
