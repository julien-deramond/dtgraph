import { describe, expect, it } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import { searchTokens } from '../src/search.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

describe('searchTokens', () => {
  const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));

  it('returns nothing for a blank query', () => {
    expect(searchTokens(graph, '   ')).toEqual([]);
  });

  it('ranks whole-segment matches, then prefixes, then substrings', () => {
    const keys = searchTokens(graph, 'text').map((hit) => hit.key);
    expect(keys.slice(0, 2).sort()).toEqual(['button.text', 'semantic.text']);
  });

  it('is case-insensitive and matches across segments with spaces', () => {
    expect(searchTokens(graph, 'BUTTON back').map((hit) => hit.key)).toEqual(['button.background']);
  });

  it('prefers shorter paths among equal ranks and honors the limit', () => {
    const keys = searchTokens(graph, 'b', 2).map((hit) => hit.key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe('color.blue');
  });
});
