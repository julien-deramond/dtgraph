import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  renderTokenGraphToSvg,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import type { NamedTokenTree, TokenGraph } from '@dtgraph/core';
import type { ThemeColors, ViewerTheme } from '@dtgraph/viewer';

/**
 * A story's `dtgraph` parameter: a single DTCG document (already-parsed JSON), or multiple —
 * each entry is treated like a separate file, so aliases resolve across all of them the same
 * way the CLI's multi-file support and `<TokenGraph files={...}>` do.
 */
export interface DtgraphParameter {
  tokens: unknown | unknown[];
  /**
   * The map's theme: `"dark"`, `"light"`, or your own canvas colors (`ThemeColors` from
   * `@dtgraph/viewer`). Defaults to following the manager's light/dark theme. Set it once in
   * `.storybook/preview` and every story's graph gets it: Storybook merges it with each story's
   * `tokens`.
   */
  theme?: ViewerTheme | ThemeColors;
}

/**
 * Parse and resolve a story's `dtgraph` parameter into a `TokenGraph` — entirely in-memory,
 * since story parameters are already JS values in the Storybook manager (no filesystem access
 * needed or attempted). Errors propagate unmodified, same policy as the CLI, playground, and
 * `<TokenGraph>`.
 */
export function buildStoryTokenGraph(tokens: unknown | unknown[]): TokenGraph {
  const documents = Array.isArray(tokens) ? tokens : [tokens];
  const namedTrees: NamedTokenTree[] = documents.map((document, index) => ({
    source: `story-tokens-${index}`,
    tree: parseTokenTree(document),
  }));
  const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
  const edges = resolveAliasEdgesAcrossFiles(namedTrees);
  return buildTokenGraph(nodes, edges);
}

/** Parse, resolve, and render a story's `dtgraph` parameter to the static SVG string. */
export function renderStoryTokensToSvg(tokens: unknown | unknown[]): string {
  return renderTokenGraphToSvg(buildStoryTokenGraph(tokens));
}
