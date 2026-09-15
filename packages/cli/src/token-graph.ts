import { readFile } from 'node:fs/promises';

import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import type { NamedTokenTree, TokenGraph } from '@dtgraph/core';

export interface TokenFileInput {
  /** File path, used as the `source` tag for cross-file collision/error messages. */
  source: string;
  /** Raw file contents (DTCG JSON). */
  content: string;
}

/** Read a list of file paths into `{ source, content }` pairs `loadAndResolveTokenFiles` accepts. */
export async function readTokenFiles(paths: string[]): Promise<TokenFileInput[]> {
  return Promise.all(
    paths.map(async (source) => ({ source, content: await readFile(source, 'utf8') })),
  );
}

/**
 * Parse and resolve one or more DTCG token file contents into a single `TokenGraph`. Errors
 * from JSON parsing, DTCG parsing, alias resolution, or cycle detection all propagate
 * unmodified — callers should not re-wrap them.
 */
export function loadAndResolveTokenFiles(files: TokenFileInput[]): TokenGraph {
  const namedTrees: NamedTokenTree[] = files.map(({ source, content }) => ({
    source,
    tree: parseTokenTree(JSON.parse(content) as unknown),
  }));
  const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
  const edges = resolveAliasEdgesAcrossFiles(namedTrees);
  return buildTokenGraph(nodes, edges);
}
