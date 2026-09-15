# basic-tokens example

A small DTCG token file (`tokens.json`) with a mix of primitive tokens, scalar aliases, and a
composite (`border`) token with an aliased member — enough to exercise both the `dtgraph render`
and `dtgraph validate` commands end to end.

## Try it

From the repo root, after `pnpm install` and `pnpm run build`:

```sh
node packages/cli/dist/cli.js validate examples/basic-tokens/tokens.json
node packages/cli/dist/cli.js render examples/basic-tokens/tokens.json -o graph.svg
```

Or, once `dtgraph` is installed globally (see [`packages/cli`](../../packages/cli)):

```sh
dtgraph validate examples/basic-tokens/tokens.json
dtgraph render examples/basic-tokens/tokens.json -o graph.svg
```
