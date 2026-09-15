import { readFile } from 'node:fs/promises';

import { MissingResolverContextsError, buildTokenGraphFromDocuments } from '@dtgraph/core';
import type { ResolverInput, TokenGraphBuild } from '@dtgraph/core';

export interface TokenFileInput {
  /** File path, used as the `source` tag for cross-file collision/error messages and `$ref` lookups. */
  source: string;
  /** Raw file contents (DTCG JSON, or a DTCG resolver document). */
  content: string;
}

export interface LoadTokenGraphOptions {
  /** Context per modifier (`{ theme: "dark" }`), applied when one of the files is a resolver. */
  context?: ResolverInput;
}

/** Read a list of file paths into `{ source, content }` pairs `loadAndResolveTokenFiles` accepts. */
export async function readTokenFiles(paths: string[]): Promise<TokenFileInput[]> {
  return Promise.all(
    paths.map(async (source) => ({ source, content: await readFile(source, 'utf8') })),
  );
}

/**
 * Turn the values of repeated `--context <modifier>=<context>` flags (each possibly holding
 * several comma-separated pairs) into a resolver input map. Throws on a pair without `=`.
 */
export function parseContextOptions(values: string[]): ResolverInput {
  const input: ResolverInput = {};
  for (const pair of values.flatMap((value) => value.split(','))) {
    const separator = pair.indexOf('=');
    const modifier = pair.slice(0, separator).trim();
    const context = pair.slice(separator + 1).trim();
    if (separator === -1 || modifier.length === 0 || context.length === 0) {
      throw new Error(
        `Invalid --context value "${pair}": expected <modifier>=<context>, e.g. --context theme=dark`,
      );
    }
    input[modifier] = context;
  }
  return input;
}

/**
 * Parse and resolve one or more DTCG token file contents into a single `TokenGraph`. When one
 * of the files is a DTCG resolver document, the other files are the pool its `$ref`s resolve
 * against and `options.context` picks each modifier's context (defaults apply otherwise). Errors
 * from JSON parsing, DTCG parsing, resolver validation, alias resolution, or cycle detection all
 * propagate unmodified — callers should not re-wrap them.
 */
export function loadAndResolveTokenFiles(
  files: TokenFileInput[],
  options: LoadTokenGraphOptions = {},
): TokenGraphBuild {
  const documents = files.map(({ source, content }) => ({
    source,
    document: JSON.parse(content) as unknown,
  }));
  return buildTokenGraphFromDocuments(documents, { input: options.context });
}

/**
 * The `--context` flags that would unblock a resolver rejected for want of a context, ready to
 * paste, with each modifier's choices spelled out. Undefined for every other kind of error: the
 * CLI prints this under the message only when it can actually help.
 */
export function describeContextHint(error: unknown): string | undefined {
  if (!(error instanceof MissingResolverContextsError)) return undefined;
  const contextsOf = (name: string): string[] =>
    error.modifiers.find((modifier) => modifier.name === name)?.contexts ?? [];
  const flags = error.missing.map((name) => `--context ${name}=${contextsOf(name)[0]}`).join(' ');
  const choices = error.missing.map((name) => `${name}: ${contextsOf(name).join(', ')}`).join('; ');
  return `Hint: add ${flags} (${choices})`;
}
