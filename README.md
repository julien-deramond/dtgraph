# dtgraph

dtgraph turns [DTCG](https://tr.designtokens.org/) design token files into an interactive dependency graph.

It parses DTCG token files and renders the reference graph between tokens — which
primitives feed which semantic tokens, what breaks if a value changes, and where
cycles hide — as an interactive node graph, so token lineage and blast radius stay
legible as a design system grows.

## Try it

Open the [playground](https://julien-deramond.github.io/dtgraph/) and drop a DTCG file on it
(or a `*.resolver.json` with the files it references, then switch between its contexts):
tokens cluster by what they reference, the most-depended-on primitives are the biggest dots,
hovering spotlights relations, clicking opens a detail panel, `/` searches. Nothing is uploaded.

## Packages

| Package                                    | What it is                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [`@dtgraph/core`](packages/core)           | Parse DTCG files and resolver documents, resolve aliases (across files and per context), build the token graph, render a static SVG. |
| [`dtgraph`](packages/cli)                  | CLI: `dtgraph validate` and `dtgraph render` for one or more token files, or a resolver plus its files. |
| [`@dtgraph/viewer`](packages/viewer)       | The interactive WebGL map: clusters, blast radius, hover/click focus, search, detail panel.  |
| [`@dtgraph/mdx`](packages/mdx)             | `<TokenGraph>` for MDX/Astro pages, static SVG or interactive.                              |
| [`@dtgraph/storybook`](packages/storybook) | Storybook addon panel showing each story's token graph.                                     |

Docs live at <https://julien-deramond.github.io/dtgraph/docs/>.

## Status

Early-stage / pre-release. Core parsing, graph model, and rendering are still being
designed — see the open issues for what's in progress.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how issues and
pull requests are triaged and reviewed, including the workflow for AI-agent-submitted
issues.

## License

[MIT](LICENSE)
