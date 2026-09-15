import type { ViewerGraph } from './build-graph.js';

export interface SearchHit {
  /** Node key (dotted path). */
  key: string;
  /** Lower is better. */
  rank: number;
}

/**
 * Rank tokens for a query: a whole path segment equal to the query first, then a segment
 * starting with it, then any substring of the full path; ties broken by path length (shorter
 * paths are usually the primitives people look for) and then alphabetically. Case-insensitive.
 * Whitespace in the query matches across segment boundaries (`btn bg` finds `button.primary.bg`).
 */
export function searchTokens(graph: ViewerGraph, query: string, limit = 12): SearchHit[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  graph.forEachNode((key) => {
    const lower = key.toLowerCase();
    if (!terms.every((term) => lower.includes(term))) return;
    const segments = lower.split('.');
    let rank = 2;
    if (segments.some((segment) => terms.includes(segment))) rank = 0;
    else if (segments.some((segment) => terms.some((term) => segment.startsWith(term)))) rank = 1;
    hits.push({ key, rank });
  });
  hits.sort((a, b) => a.rank - b.rank || a.key.length - b.key.length || a.key.localeCompare(b.key));
  return hits.slice(0, limit);
}
