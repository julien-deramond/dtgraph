import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildTokenGraph } from '../src/graph.js';
import { flattenTokenTree, parseTokenTree } from '../src/parse.js';
import { resolveAliasEdges } from '../src/resolve.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(category: 'valid' | 'invalid', file: string): unknown {
  const raw = readFileSync(join(fixturesDir, category, file), 'utf8');
  return JSON.parse(raw);
}

describe('buildTokenGraph', () => {
  it('exposes every node and edge, plus working lookup helpers', () => {
    const tree = parseTokenTree(loadFixture('valid', 'alias-and-extensions.json'));
    const nodes = flattenTokenTree(tree);
    const edges = resolveAliasEdges(tree);
    const graph = buildTokenGraph(nodes, edges);

    expect(graph.nodes).toBe(nodes);
    expect(graph.edges).toBe(edges);

    const accent = graph.getNode(['color', 'accent']);
    expect(accent?.value).toBe('{color.brand}');
    expect(graph.getNode(['color', 'does-not-exist'])).toBeUndefined();

    expect(graph.getOutgoingEdges(['color', 'accent'])).toEqual([
      { from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' },
    ]);
    expect(graph.getIncomingEdges(['color', 'brand'])).toEqual([
      { from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' },
    ]);
    expect(graph.getOutgoingEdges(['color', 'brand'])).toEqual([]);
    expect(graph.getIncomingEdges(['color', 'accent'])).toEqual([]);
  });
});
