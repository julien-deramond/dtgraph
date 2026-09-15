import type { TokenEdge, TokenGraph, TokenNode } from './types.js';

function pushEdge(map: Map<string, TokenEdge[]>, key: string, edge: TokenEdge): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [edge]);
  } else {
    existing.push(edge);
  }
}

/**
 * Build a `TokenGraph` — nodes plus edges, with `getNode`/`getOutgoingEdges`/`getIncomingEdges`
 * lookup helpers — from a flat node list (e.g. `flattenTokenTree`) and the edges resolved for
 * it (e.g. `resolveAliasEdges`).
 */
export function buildTokenGraph(nodes: TokenNode[], edges: TokenEdge[]): TokenGraph {
  const nodesByPath = new Map<string, TokenNode>();
  for (const node of nodes) {
    nodesByPath.set(node.path.join('.'), node);
  }

  const outgoingByPath = new Map<string, TokenEdge[]>();
  const incomingByPath = new Map<string, TokenEdge[]>();
  for (const edge of edges) {
    pushEdge(outgoingByPath, edge.from.join('.'), edge);
    pushEdge(incomingByPath, edge.to.join('.'), edge);
  }

  return {
    nodes,
    edges,
    getNode(path: string[]): TokenNode | undefined {
      return nodesByPath.get(path.join('.'));
    },
    getOutgoingEdges(path: string[]): TokenEdge[] {
      return outgoingByPath.get(path.join('.')) ?? [];
    },
    getIncomingEdges(path: string[]): TokenEdge[] {
      return incomingByPath.get(path.join('.')) ?? [];
    },
  };
}
