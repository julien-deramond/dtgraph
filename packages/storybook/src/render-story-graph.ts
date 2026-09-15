import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  renderTokenGraphToSvg,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import type { NamedTokenTree } from '@dtgraph/core';

/**
 * A story's `dtgraph` parameter: a single DTCG document (already-parsed JSON), or multiple —
 * each entry is treated like a separate file, so aliases resolve across all of them the same
 * way the CLI's multi-file support and `<TokenGraph files={...}>` do.
 */
export interface DtgraphParameter {
  tokens: unknown | unknown[];
}

/**
 * Parse, resolve, and render a story's `dtgraph` parameter to an SVG string — entirely
 * in-memory, since story parameters are already JS values in the Storybook manager (no
 * filesystem access needed or attempted). Errors propagate unmodified, same policy as the CLI,
 * playground, and `<TokenGraph>`.
 */
export function renderStoryTokensToSvg(tokens: unknown | unknown[]): string {
  const documents = Array.isArray(tokens) ? tokens : [tokens];
  const namedTrees: NamedTokenTree[] = documents.map((document, index) => ({
    source: `story-tokens-${index}`,
    tree: parseTokenTree(document),
  }));
  const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
  const edges = resolveAliasEdgesAcrossFiles(namedTrees);
  return renderTokenGraphToSvg(buildTokenGraph(nodes, edges));
}
