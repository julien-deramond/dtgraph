import { flattenTokenTree, isResolverDocument, parseTokenTree } from '@dtgraph/core';

import type { PlaygroundFileInput } from '../playground.js';
import { keyOf } from './graph.js';

/**
 * Which file declared each token path. A resolver build tags `TokenNode.source` itself, but plain
 * multi-file input (`buildTokenGraphFromDocuments` without a resolver) leaves it unset, so the
 * prototype's "source file" columns rebuild the mapping from the files. Files that don't parse
 * are skipped: the graph build has already reported them.
 */
export function sourcesByPath(files: readonly PlaygroundFileInput[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const file of files) {
    try {
      const document = JSON.parse(file.content) as unknown;
      if (isResolverDocument(document)) continue;
      for (const token of flattenTokenTree(parseTokenTree(document))) {
        sources.set(keyOf(token.path), file.source);
      }
    } catch {
      // Reported by the graph build.
    }
  }
  return sources;
}
