/**
 * Prototype for #139: which column a token goes in. DTCG has no notion of tier, so each strategy
 * here infers one from something else, and the page lets you switch between them to compare.
 */
import type { TokenGraph, TokenNode } from '@dtgraph/core';

import { aliasDepths, keyOf } from './graph.js';

export type TierStrategy = 'group-role' | 'depth' | 'source';

export interface ColumnSpec {
  /** Header text. */
  label: string;
}

export interface ColumnAssignment {
  columns: ColumnSpec[];
  /** Column index per token key. */
  columnOf: Map<string, number>;
}

/** `$extensions` key a token can carry to pin its column by name (`"core"`, `"semantic"`, …). */
export const TIER_EXTENSION = 'com.dtgraph.tier';

const TIERS: ColumnSpec[] = [{ label: 'Core' }, { label: 'Semantic' }, { label: 'Component' }];

/**
 * Three columns from what each top-level group does in the graph as a whole, counting only edges
 * that leave the group: a group that references no other group is Core, one that no other group
 * references is Component, and one that does both is Semantic. Deciding per group rather than per
 * token keeps a component's literal values (`btn.padding-x: 0.75rem`) next to its aliased ones,
 * which per-token alias depth would pull into the Core column.
 */
export function groupRoleTier(graph: TokenGraph): Map<string, number> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of graph.edges) {
    const from = edge.from[0];
    const to = edge.to[0];
    if (from === to) continue;
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }
  const tierOf = new Map<string, number>();
  for (const node of graph.nodes) {
    const group = node.path[0];
    const out = outgoing.get(group) ?? 0;
    const into = incoming.get(group) ?? 0;
    tierOf.set(keyOf(node.path), out === 0 ? 0 : into === 0 ? 2 : 1);
  }
  return tierOf;
}

/** The part of a source id that names its tier: its first directory, else the file name. */
function sourceTier(source: string): string {
  const file = source.replace(/#.*$/, '');
  const slash = file.indexOf('/');
  return slash > 0 ? file.slice(0, slash) : file.replace(/\.(tokens\.)?json$/, '');
}

function pinnedTier(node: TokenNode): number | undefined {
  const value = node.extensions?.[TIER_EXTENSION];
  if (typeof value !== 'string') return undefined;
  const index = TIERS.findIndex((tier) => tier.label.toLowerCase() === value.toLowerCase());
  return index === -1 ? undefined : index;
}

/**
 * Assign every token to a column.
 *
 * - `group-role` (the default): three columns, see {@link groupRoleTier}.
 * - `depth`: one column per alias depth, as the viewer's small-graph layout does. Shows how many
 *   columns real sets need and where literal-valued component tokens land.
 * - `source`: one column per source directory (or file), ordered by which sources reference
 *   which. Exact for a set laid out as `primitive/`, `semantic/`, `component/`; one column
 *   for a single file. `sourceOf` supplies sources for builds that don't tag `TokenNode.source`.
 *
 * With `group-role`, a token's own `$extensions["com.dtgraph.tier"]` (`core`, `semantic`,
 * `component`) overrides the inferred column.
 */
export function assignColumns(
  graph: TokenGraph,
  strategy: TierStrategy,
  sourceOf: (node: TokenNode) => string | undefined = (node) => node.source,
): ColumnAssignment {
  if (strategy === 'depth') {
    const depths = aliasDepths(graph);
    const max = Math.max(0, ...depths.values());
    return {
      columns: Array.from({ length: max + 1 }, (_, i) => ({ label: `Depth ${i}` })),
      columnOf: depths,
    };
  }

  if (strategy === 'source') {
    const tierName = new Map<string, string>();
    for (const node of graph.nodes) {
      const source = sourceOf(node);
      tierName.set(keyOf(node.path), source === undefined ? '(no source)' : sourceTier(source));
    }
    // Order the columns by the sources' own dependency levels: a source that references no other
    // source comes first, one that references it comes after, and so on.
    const references = new Map<string, Set<string>>();
    for (const name of tierName.values()) references.set(name, new Set());
    for (const edge of graph.edges) {
      const from = tierName.get(keyOf(edge.from)) as string;
      const to = tierName.get(keyOf(edge.to)) as string;
      if (from !== to) references.get(from)?.add(to);
    }
    const levels = new Map<string, number>();
    const visiting = new Set<string>();
    const level = (name: string): number => {
      const known = levels.get(name);
      if (known !== undefined) return known;
      if (visiting.has(name)) return 0; // Sources that reference each other: no order to find.
      visiting.add(name);
      let result = 0;
      for (const target of references.get(name) ?? []) result = Math.max(result, level(target) + 1);
      visiting.delete(name);
      levels.set(name, result);
      return result;
    };
    const names = [...references.keys()].sort((a, b) => level(a) - level(b) || a.localeCompare(b));
    const index = new Map(names.map((name, i) => [name, i]));
    const columnOf = new Map<string, number>();
    for (const [key, name] of tierName) columnOf.set(key, index.get(name) as number);
    return { columns: names.map((label) => ({ label })), columnOf };
  }

  const columnOf = groupRoleTier(graph);
  for (const node of graph.nodes) {
    const pinned = pinnedTier(node);
    if (pinned !== undefined) columnOf.set(keyOf(node.path), pinned);
  }
  return { columns: TIERS, columnOf };
}

/**
 * The family heading a row sits under: the first two path segments for deep paths
 * (`color.violet`), the first one for shallow ones (`spacing`).
 */
export function familyOf(path: string[]): string {
  if (path.length <= 1) return '';
  return path.slice(0, Math.min(2, path.length - 1)).join('.');
}
