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

### `dtgraph render <files...> [-o, --output <file>]`

Parses and resolves one or more DTCG token files (aliases are resolved across files when more
than one is given) and renders the result to an SVG token graph.

```sh
dtgraph render tokens.json -o graph.svg
dtgraph render color.json typography.json -o graph.svg
dtgraph render tokens.json > graph.svg   # no -o: SVG is written to stdout
```

| Flag              | Description                                             |
| ------------------ | -------------------------------------------------------- |
| `-o, --output <file>` | Write the SVG to this file instead of stdout            |

### `dtgraph validate <files...> [--json]`

Parses, resolves, and cycle-checks one or more DTCG token files without producing any output
artifact — useful in CI. Prints a one-line summary by default, or the full structured result
with `--json`.

```sh
dtgraph validate tokens.json
dtgraph validate color.json typography.json --json
```

| Flag     | Description                                               |
| -------- | ----------------------------------------------------------- |
| `--json` | Print a machine-readable JSON result instead of a summary |

## Exit codes

| Code | Meaning                                                                 |
| ---- | ------------------------------------------------------------------------ |
| `0`  | Success — files parsed, aliases resolved, no cycles found              |
| `1`  | Failure — malformed JSON/DTCG, a dangling alias, an alias cycle, or a cross-file token-path collision |

On failure, the error message printed (or, with `--json`, the `error.message` field) comes
directly from `@dtgraph/core` — it is never re-wrapped or genericized, so it always includes the
offending token path and a link to the relevant part of the DTCG spec.

## Example

See [`examples/basic-tokens`](../../examples/basic-tokens) for a runnable example against a
small sample token file.
