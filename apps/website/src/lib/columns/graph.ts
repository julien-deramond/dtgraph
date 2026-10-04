/**
 * Prototype for #139: the graph helpers a column view needs, written against core's `TokenGraph`
 * instead of the viewer's graphology `ViewerGraph`. These are the candidates to move into
 * `@dtgraph/core` (or a small shared module) if the column view becomes a package; the viewer's
 * versions (`dependencyLevels`, `collectUpstream` / `collectDownstream`, `searchTokens`) would
 * then wrap these.
 */
import type { TokenEdge, TokenGraph } from '@dtgraph/core';

export const keyOf = (path: string[]): string => path.join('.');

/**
 * Alias depth of every token: 0 for tokens that reference nothing, else one more than the
 * deepest token they reference. Core rejects alias cycles, so this is always defined; a guard
 * still stops a malformed graph from looping.
 */
export function aliasDepths(graph: TokenGraph): Map<string, number> {
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (path: string[]): number => {
    const key = keyOf(path);
    const known = depths.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return 0;
    visiting.add(key);
    let result = 0;
    for (const edge of graph.getOutgoingEdges(path)) result = Math.max(result, depth(edge.to) + 1);
    visiting.delete(key);
    depths.set(key, result);
    return result;
  };
  for (const node of graph.nodes) depth(node.path);
  return depths;
}

function walk(start: string, next: (key: string) => string[]): Set<string> {
  const seen = new Set<string>();
  const stack = next(start);
  while (stack.length > 0) {
    const key = stack.pop() as string;
    if (key === start || seen.has(key)) continue;
    seen.add(key);
    stack.push(...next(key));
  }
  return seen;
}

/** Transitive sources of a token: what it references, recursively. */
export function collectUpstream(graph: TokenGraph, key: string): Set<string> {
  return walk(key, (k) => graph.getOutgoingEdges(k.split('.')).map((e) => keyOf(e.to)));
}

/** Transitive consumers of a token (its blast radius): what references it, recursively. */
export function collectDownstream(graph: TokenGraph, key: string): Set<string> {
  return walk(key, (k) => graph.getIncomingEdges(k.split('.')).map((e) => keyOf(e.from)));
}

/**
 * The edges to draw for a focused token: one hop (its own references and direct consumers), or
 * the full chains both ways, the way the map lights them.
 */
export function focusEdges(graph: TokenGraph, key: string, fullChain: boolean): TokenEdge[] {
  const path = key.split('.');
  if (!fullChain) return [...graph.getOutgoingEdges(path), ...graph.getIncomingEdges(path)];
  const upstream = collectUpstream(graph, key);
  const downstream = collectDownstream(graph, key);
  const edges: TokenEdge[] = [];
  for (const k of [key, ...upstream]) edges.push(...graph.getOutgoingEdges(k.split('.')));
  for (const k of downstream) {
    for (const edge of graph.getOutgoingEdges(k.split('.'))) {
      const to = keyOf(edge.to);
      if (to === key || downstream.has(to)) edges.push(edge);
    }
  }
  return edges;
}

/**
 * Whether a token path matches a search query: every whitespace-separated term is a
 * case-insensitive substring of the dotted path (`btn bg` finds `button.primary.bg`). The column
 * view filters rows instead of ranking a short result list, so it needs the predicate, not the
 * viewer's ranking.
 */
export function matchesQuery(key: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = key.toLowerCase();
  return terms.every((term) => lower.includes(term));
}
