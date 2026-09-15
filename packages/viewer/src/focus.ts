import type { ViewerGraph } from './build-graph.js';

/** Everything a selected token relates to, in both directions, transitively. */
export interface FocusSets {
  /** Tokens the selected token resolves through (what it references, recursively). */
  upstream: Set<string>;
  /** Tokens that would change if the selected token changed (what references it, recursively). */
  downstream: Set<string>;
  /** `upstream ∪ downstream ∪ { selected }`. */
  all: Set<string>;
}

function walk(graph: ViewerGraph, start: string, next: (node: string) => string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...next(start)];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === start || seen.has(node)) continue;
    seen.add(node);
    stack.push(...next(node));
  }
  return seen;
}

/** Transitive sources of `node`: edges point consumer → source, so follow outbound neighbors. */
export function collectUpstream(graph: ViewerGraph, node: string): Set<string> {
  return walk(graph, node, (n) => graph.outNeighbors(n));
}

/** Transitive consumers of `node` (its blast radius): follow inbound neighbors. */
export function collectDownstream(graph: ViewerGraph, node: string): Set<string> {
  return walk(graph, node, (n) => graph.inNeighbors(n));
}

export function collectFocus(graph: ViewerGraph, node: string): FocusSets {
  const upstream = collectUpstream(graph, node);
  const downstream = collectDownstream(graph, node);
  return { upstream, downstream, all: new Set([node, ...upstream, ...downstream]) };
}

/** Whether an edge lies on a chain between `node` and its focus sets (so it should stay lit). */
export function edgeInFocus(
  graph: ViewerGraph,
  edge: string,
  selected: string,
  focus: FocusSets,
): boolean {
  const [source, target] = graph.extremities(edge);
  // consumer → source: an upstream edge starts at the selection or another upstream token.
  const upstreamEdge =
    (source === selected || focus.upstream.has(source)) && focus.upstream.has(target);
  const downstreamEdge =
    focus.downstream.has(source) && (target === selected || focus.downstream.has(target));
  return upstreamEdge || downstreamEdge;
}
