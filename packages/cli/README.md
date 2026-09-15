# dtgraph

Command-line interface for [dtgraph](https://github.com/julien-deramond/dtgraph): render and
validate [DTCG](https://www.designtokens.org/tr/2025.10/format/) design token files.

## Install

```sh
npm install --global dtgraph
```

Or run it without installing, via `npx`:

```sh
npx dtgraph <command> ...
```

## Usage

### `dtgraph render <files...> [-o, --output <file>] [-c, --context <modifier=context>]`

Parses and resolves one or more DTCG token files (aliases are resolved across files when more
than one is given) and renders the result to an SVG token graph. If one of the files is a
[resolver](#resolver-files), it drives the merge.

```sh
dtgraph render tokens.json -o graph.svg
dtgraph render color.json typography.json -o graph.svg
dtgraph render tokens.json > graph.svg   # no -o: SVG is written to stdout
dtgraph render ds.resolver.json base.json themes/*.json components.json -c theme=dark -o dark.svg
```

| Flag                              | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `-o, --output <file>`             | Write the SVG to this file instead of stdout                            |
| `-c, --context <modifier=context>` | With a resolver: select a modifier context (repeatable, or comma-separated) |

### `dtgraph validate <files...> [--json] [-c, --context <modifier=context>]`

Parses, resolves, and cycle-checks one or more DTCG token files without producing any output
artifact — useful in CI. Prints a one-line summary by default, or the full structured result
with `--json`. With a [resolver](#resolver-files), both name the resolver and the contexts applied.

```sh
dtgraph validate tokens.json
dtgraph validate color.json typography.json --json
dtgraph validate ds.resolver.json base.json themes/*.json components.json --context theme=dark
```

| Flag                              | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `--json`                          | Print a machine-readable JSON result instead of a summary               |
| `-c, --context <modifier=context>` | With a resolver: select a modifier context (repeatable, or comma-separated) |

## Resolver files

A [DTCG resolver](https://www.designtokens.org/tr/2025.10/resolver/) (`*.resolver.json`)
composes a design system's token files from **sets** and **modifiers** with named **contexts**
(`theme: light | dark`), in a `resolutionOrder` where later sources override earlier ones. Pass
the resolver together with every token file it references; the CLI detects it by shape (an object
with a `resolutionOrder` array), resolves its `$ref`s against the files given (exact path, then
relative to the resolver, then by unique file name), applies `--context` or each modifier's
`default`, merges with override semantics, and only then resolves aliases. Same-document
`#/sets/…` references, inline sources, `file.json#/pointer` sub-trees and `$ref` override keys
are supported; remote references are not fetched. See
[`examples/resolver-themes`](../../examples/resolver-themes) for a runnable example.

## Exit codes

| Code | Meaning                                                                 |
| ---- | ------------------------------------------------------------------------ |
| `0`  | Success — files parsed, aliases resolved, no cycles found              |
| `1`  | Failure — malformed JSON/DTCG or resolver, a dangling alias, an alias cycle, an unknown modifier/context, or a cross-file token-path collision (without a resolver) |

On failure, the error message printed (or, with `--json`, the `error.message` field) comes
directly from `@dtgraph/core` — it is never re-wrapped or genericized, so it always includes the
offending token path and a link to the relevant part of the DTCG spec.

## Example

See [`examples/basic-tokens`](../../examples/basic-tokens) for a runnable example against a
small sample token file, and [`examples/resolver-themes`](../../examples/resolver-themes) for a
resolver-driven light/dark setup.
