import type { TokenEdge, TokenGraph, TokenNode } from '@dtgraph/core';
import Graph from 'graphology';

import { assignCategoryColors, DARK_PALETTE } from './palette.js';

/** Which token property drives node color: the top-level group name, or the DTCG `$type`. */
export type ColorBy = 'group' | 'type';

/** Node attributes on the graphology graph the viewer renders. */
export interface ViewerNodeAttributes {
  /** Sigma's rendered label: the last path segment. */
  label: string;
  /** Full dotted token path (the graphology node key, duplicated for convenience). */
  path: string;
  /** Top-level group name (first path segment), `""` for a root-level token. */
  group: string;
  /** DTCG `$type` (inherited resolved by core), or `"untyped"`. */
  tokenType: string;
  /** Number of tokens that directly or transitively alias this token: its blast radius. */
  dependents: number;
  color: string;
  size: number;
  x: number;
  y: number;
  zIndex: number;
  /** The originating token, for detail panels; never rendered by Sigma. */
  token: TokenNode;
}

/** Edge attributes on the graphology graph the viewer renders. */
export interface ViewerEdgeAttributes {
  kind: 'alias' | 'composite-member';
  member?: string;
  reference: string;
  color: string;
  size: number;
  type: 'arrow';
  zIndex: number;
}

export type ViewerGraph = Graph<ViewerNodeAttributes, ViewerEdgeAttributes>;

export interface BuildViewerGraphOptions {
  /** Defaults to `"group"`. */
  colorBy?: ColorBy;
  /** Defaults to the dark-canvas palette. */
  palette?: readonly string[];
}

export const UNTYPED = 'untyped';
export const ROOT_GROUP = '';

function pathKey(path: string[]): string {
  return path.join('.');
}

/**
 * A token's effective `$type`: its own (or group-inherited) type from core, else the type of the
 * token its `$value` aliases, followed through the chain. DTCG says an alias token takes the type
 * of the token it references, and `{semantic.primary}`-style tokens rarely repeat `$type`, so
 * without this most semantic/component tokens would color as "untyped".
 */
export function resolveTokenTypes(graph: TokenGraph): Map<string, string> {
  const aliasTarget = new Map<string, string>();
  for (const edge of graph.edges) {
    if ((edge.kind ?? 'alias') === 'alias') aliasTarget.set(pathKey(edge.from), pathKey(edge.to));
  }
  const types = new Map<string, string>();
  const resolve = (start: string): string => {
    const known = types.get(start);
    if (known !== undefined) return known;
    const seen = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const own = graph.getNode(current.split('.'))?.type;
      if (own !== undefined) return own;
      current = aliasTarget.get(current);
    }
    return UNTYPED;
  };
  for (const node of graph.nodes) {
    const key = pathKey(node.path);
    types.set(key, resolve(key));
  }
  return types;
}

/** The category key a node is colored by. */
export function categoryOf(node: TokenNode, colorBy: ColorBy, tokenType: string): string {
  if (colorBy === 'type') return tokenType;
  return node.path.length > 1 ? node.path[0] : ROOT_GROUP;
}

/**
 * Count, for every token, how many *other* tokens depend on it directly or transitively — i.e.
 * everything that would change if its value changed. The token graph is acyclic by construction
 * (core rejects alias cycles), but the walk still guards against revisiting a node so a malformed
 * graph cannot loop forever.
 */
export function countTransitiveDependents(graph: TokenGraph): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const to = pathKey(edge.to);
    const list = incoming.get(to);
    const from = pathKey(edge.from);
    if (list === undefined) incoming.set(to, [from]);
    else list.push(from);
  }

  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    const start = pathKey(node.path);
    const seen = new Set<string>();
    const stack = [...(incoming.get(start) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (current === start || seen.has(current)) continue;
      seen.add(current);
      for (const next of incoming.get(current) ?? []) stack.push(next);
    }
    counts.set(start, seen.size);
  }
  return counts;
}

/**
 * Node radius from its dependent count: a square-root scale so heavily-used primitives are
 * clearly bigger without dwarfing everything else, clamped to keep labels and hit areas sane.
 */
export function nodeSizeForDependents(dependents: number): number {
  return Math.min(3 + 2.6 * Math.sqrt(dependents), 28);
}

function edgeKey(edge: TokenEdge, index: number): string {
  return `${pathKey(edge.from)}->${pathKey(edge.to)}#${index}`;
}

/**
 * Turn a core `TokenGraph` into the graphology graph Sigma renders: one node per token keyed by
 * its dotted path, one directed edge per alias (consumer → source), colored by group or type and
 * sized by blast radius. Positions are left at the origin — see `layoutViewerGraph`.
 */
export function buildViewerGraph(
  tokenGraph: TokenGraph,
  options: BuildViewerGraphOptions = {},
): ViewerGraph {
  const colorBy = options.colorBy ?? 'group';
  const palette = options.palette ?? DARK_PALETTE;
  const graph: ViewerGraph = new Graph({ type: 'directed', multi: true });

  const types = resolveTokenTypes(tokenGraph);
  const categoryFor = (node: TokenNode): string =>
    categoryOf(node, colorBy, types.get(pathKey(node.path)) ?? UNTYPED);
  const categories = assignCategoryColors(tokenGraph.nodes.map(categoryFor), palette);
  const dependents = countTransitiveDependents(tokenGraph);

  for (const node of tokenGraph.nodes) {
    const path = pathKey(node.path);
    if (graph.hasNode(path)) continue;
    const count = dependents.get(path) ?? 0;
    graph.addNode(path, {
      label: node.path[node.path.length - 1] || path,
      path,
      group: node.path.length > 1 ? node.path[0] : ROOT_GROUP,
      tokenType: types.get(path) ?? UNTYPED,
      dependents: count,
      color: categories.get(categoryFor(node)) ?? palette[0],
      size: nodeSizeForDependents(count),
      x: 0,
      y: 0,
      zIndex: count,
      token: node,
    });
  }

  tokenGraph.edges.forEach((edge, index) => {
    const from = pathKey(edge.from);
    const to = pathKey(edge.to);
    if (!graph.hasNode(from) || !graph.hasNode(to)) return;
    graph.addEdgeWithKey(edgeKey(edge, index), from, to, {
      kind: edge.kind ?? 'alias',
      member: edge.member,
      reference: edge.reference,
      color: graph.getNodeAttribute(from, 'color'),
      size: 1,
      type: 'arrow',
      zIndex: 0,
    });
  });

  return graph;
}
