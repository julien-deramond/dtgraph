import { describe, expect, it } from 'vitest';

import {
  buildViewerGraph,
  countTransitiveDependents,
  nodeSizeForDependents,
  resolveTokenTypes,
  ROOT_GROUP,
  UNTYPED,
} from '../src/build-graph.js';
import { DARK_PALETTE, LIGHT_PALETTE } from '../src/palette.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

describe('countTransitiveDependents', () => {
  it('counts direct and indirect consumers, not the token itself', () => {
    const counts = countTransitiveDependents(tokenGraphFrom(SAMPLE));
    // color.blue ← semantic.primary ← button.background
    expect(counts.get('color.blue')).toBe(2);
    // color.gray ← semantic.text ← button.text, and ← button.border (composite member)
    expect(counts.get('color.gray')).toBe(3);
    expect(counts.get('button.background')).toBe(0);
    expect(counts.get('color.unused')).toBe(0);
  });
});

describe('resolveTokenTypes', () => {
  it('follows alias chains to find a type, but not composite members', () => {
    const types = resolveTokenTypes(tokenGraphFrom(SAMPLE));
    expect(types.get('color.blue')).toBe('color');
    expect(types.get('semantic.primary')).toBe('color');
    expect(types.get('button.background')).toBe('color'); // via semantic.primary → color.blue
    expect(types.get('button.border')).toBe('border'); // own type wins over member aliases
    expect(types.get('spacing.md')).toBe('dimension');
  });

  it('reports untyped for a token with no type anywhere in its chain', () => {
    const types = resolveTokenTypes(tokenGraphFrom({ a: { $value: 1 }, b: { $value: '{a}' } }));
    expect(types.get('a')).toBe(UNTYPED);
    expect(types.get('b')).toBe(UNTYPED);
  });
});

describe('nodeSizeForDependents', () => {
  it('grows monotonically and is capped', () => {
    expect(nodeSizeForDependents(0)).toBeLessThan(nodeSizeForDependents(1));
    expect(nodeSizeForDependents(1)).toBeLessThan(nodeSizeForDependents(10));
    expect(nodeSizeForDependents(10_000)).toBe(28);
  });
});

describe('buildViewerGraph', () => {
  it('creates one node per token and one edge per alias', () => {
    const tokenGraph = tokenGraphFrom(SAMPLE);
    const graph = buildViewerGraph(tokenGraph);
    expect(graph.order).toBe(tokenGraph.nodes.length);
    expect(graph.size).toBe(tokenGraph.edges.length);
    expect(graph.hasNode('button.background')).toBe(true);
    expect(graph.hasDirectedEdge('button.background', 'semantic.primary')).toBe(true);
  });

  it('labels with the last path segment and keeps the full path and token', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    const attrs = graph.getNodeAttributes('button.background');
    expect(attrs.label).toBe('background');
    expect(attrs.path).toBe('button.background');
    expect(attrs.group).toBe('button');
    expect(attrs.tokenType).toBe('color');
    expect(attrs.token.path).toEqual(['button', 'background']);
  });

  it('colors by top-level group by default, with edges taking their source color', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    const groups = new Set<string>();
    graph.forEachNode((_, attrs) => groups.add(attrs.group));
    // Sorted groups: button, color, semantic, spacing.
    expect(graph.getNodeAttribute('button.text', 'color')).toBe(DARK_PALETTE[0]);
    expect(graph.getNodeAttribute('color.blue', 'color')).toBe(DARK_PALETTE[1]);
    expect(graph.getNodeAttribute('spacing.md', 'color')).toBe(DARK_PALETTE[3]);
    const edge = graph.edges('button.background', 'semantic.primary')[0];
    expect(graph.getEdgeAttribute(edge, 'color')).toBe(DARK_PALETTE[0]);
  });

  it('can color by $type instead, using the given palette', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE), {
      colorBy: 'type',
      palette: LIGHT_PALETTE,
    });
    // Sorted types: border, color, dimension.
    expect(graph.getNodeAttribute('button.border', 'color')).toBe(LIGHT_PALETTE[0]);
    expect(graph.getNodeAttribute('color.blue', 'color')).toBe(LIGHT_PALETTE[1]);
    expect(graph.getNodeAttribute('semantic.primary', 'color')).toBe(LIGHT_PALETTE[1]);
    expect(graph.getNodeAttribute('spacing.md', 'color')).toBe(LIGHT_PALETTE[2]);
  });

  it('sizes nodes by transitive dependents', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    expect(graph.getNodeAttribute('color.gray', 'dependents')).toBe(3);
    expect(graph.getNodeAttribute('color.gray', 'size')).toBeGreaterThan(
      graph.getNodeAttribute('semantic.text', 'size'),
    );
    expect(graph.getNodeAttribute('semantic.text', 'size')).toBeGreaterThan(
      graph.getNodeAttribute('button.text', 'size'),
    );
  });

  it('keeps composite-member edges distinct from alias edges', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    const edge = graph.edges('button.border', 'color.gray')[0];
    expect(graph.getEdgeAttributes(edge)).toMatchObject({
      kind: 'composite-member',
      member: 'color',
      reference: '{color.gray}',
      type: 'arrow',
    });
  });

  it('handles untyped and root-level tokens', () => {
    const graph = buildViewerGraph(
      tokenGraphFrom({ lonely: { $value: 4 }, group: { child: { $value: '{lonely}' } } }),
    );
    expect(graph.getNodeAttribute('lonely', 'group')).toBe(ROOT_GROUP);
    expect(graph.getNodeAttribute('lonely', 'tokenType')).toBe(UNTYPED);
    expect(graph.getNodeAttribute('lonely', 'label')).toBe('lonely');
  });

  it('renders an empty token graph as an empty graph', () => {
    const graph = buildViewerGraph(tokenGraphFrom({}));
    expect(graph.order).toBe(0);
    expect(graph.size).toBe(0);
  });
});
