# mdx-astro example

A minimal Astro + MDX project demonstrating [`@dtgraph/mdx`](../../packages/mdx)'s
`<TokenGraph>` component, both with inline tokens and reading from a file
([`src/tokens.json`](src/tokens.json)).

## Run it

From the repo root:

```sh
pnpm install
pnpm --filter examples-mdx-astro dev
```

Then open the printed local URL to see both `<TokenGraph>` renders on the page.

```sh
pnpm --filter examples-mdx-astro build   # static build, for CI
```
