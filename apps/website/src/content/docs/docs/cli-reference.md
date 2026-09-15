---
title: CLI reference
description: Every dtgraph CLI command, flag, and exit code.
sidebar:
  order: 3
---

Install with `npm install --global dtgraph`, or run without installing via `npx dtgraph ...`.
This page mirrors the CLI's own `--help` output.

```
Usage: dtgraph [options] [command]

CLI for rendering and validating DTCG design token files with dtgraph

Options:
  -V, --version                  output the version number
  -h, --help                     display help for command

Commands:
  render [options] <files...>    Render one or more DTCG token files to an SVG
                                  token graph
  validate [options] <files...>  Validate that DTCG token file(s) parse and all
                                  aliases resolve, including cycles
  help [command]                 display help for command
```

## `dtgraph render`

Parses and resolves one or more DTCG token files (aliases resolve across files when more than
one is given) and renders the result to an SVG token graph.

```
Usage: dtgraph render [options] <files...>

Render one or more DTCG token files to an SVG token graph

Arguments:
  files                DTCG token JSON file(s) to render

Options:
  -o, --output <file>  write the SVG to this file instead of stdout
  -h, --help           display help for command
```

```sh
dtgraph render tokens.json -o graph.svg
dtgraph render color.json typography.json -o graph.svg
dtgraph render tokens.json > graph.svg   # no -o: SVG goes to stdout
```

## `dtgraph validate`

Parses, resolves, and cycle-checks one or more DTCG token files without producing any output
artifact — useful in CI.

```
Usage: dtgraph validate [options] <files...>

Validate that DTCG token file(s) parse and all aliases resolve, including cycles

Arguments:
  files       DTCG token JSON file(s) to validate

Options:
  --json      print a machine-readable JSON result instead of a human-readable
              summary
  -h, --help  display help for command
```

```sh
dtgraph validate tokens.json
dtgraph validate color.json typography.json --json
```

With `--json`, a failure looks like:

```json
{
  "ok": false,
  "files": ["tokens.json"],
  "error": {
    "message": "Alias \"{color.nonexistent}\" does not resolve to any known token at \"color.accent\" (see https://www.designtokens.org/tr/2025.10/format/#aliases-references)",
    "path": ["color", "accent"],
    "specReference": "https://www.designtokens.org/tr/2025.10/format/#aliases-references"
  }
}
```

## Exit codes

| Code | Meaning                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------- |
| `0`  | Success — files parsed, aliases resolved, no cycles found                                              |
| `1`  | Failure — malformed JSON/DTCG, a dangling alias, an alias cycle, or a cross-file token-path collision |

Error output (or, with `--json`, `error.message`) comes directly from `@dtgraph/core` — never
re-wrapped or genericized, so it always includes the offending token path and a link to the
relevant part of the DTCG spec, as in the example above.

See [`packages/cli`](https://github.com/julien-deramond/dtgraph/tree/main/packages/cli) for the
full README and [`examples/basic-tokens`](https://github.com/julien-deramond/dtgraph/tree/main/examples/basic-tokens)
for a runnable example.
