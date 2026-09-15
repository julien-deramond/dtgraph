import { describe, expect, it } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import {
  defaultIterations,
  layoutViewerGraph,
  placeIsolatesAsSatellites,
  viewerExtent,
} from '../src/layout.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

describe('layoutViewerGraph', () => {
  it('gives every node finite coordinates', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    layoutViewerGraph(graph);
    graph.forEachNode((_, attrs) => {
      expect(Number.isFinite(attrs.x)).toBe(true);
      expect(Number.isFinite(attrs.y)).toBe(true);
    });
  });

  it('is deterministic', () => {
    const a = buildViewerGraph(tokenGraphFrom(SAMPLE));
    const b = buildViewerGraph(tokenGraphFrom(SAMPLE));
    layoutViewerGraph(a);
    layoutViewerGraph(b);
    a.forEachNode((node, attrs) => {
      expect(b.getNodeAttributes(node)).toMatchObject({ x: attrs.x, y: attrs.y });
    });
  });

  it('pulls connected tokens closer together than unrelated ones', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    layoutViewerGraph(graph);
    const d = (a: string, b: string) =>
      Math.hypot(
        graph.getNodeAttribute(a, 'x') - graph.getNodeAttribute(b, 'x'),
        graph.getNodeAttribute(a, 'y') - graph.getNodeAttribute(b, 'y'),
      );
    expect(d('button.background', 'semantic.primary')).toBeLessThan(
      d('button.background', 'color.unused'),
    );
  });

  it('places isolated tokens outside the connected layout', () => {
    const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));
    layoutViewerGraph(graph);
    const connected: string[] = [];
    graph.forEachNode((node) => {
      if (graph.degree(node) > 0) connected.push(node);
    });
    const cx = connected.reduce((s, n) => s + graph.getNodeAttribute(n, 'x'), 0) / connected.length;
    const cy = connected.reduce((s, n) => s + graph.getNodeAttribute(n, 'y'), 0) / connected.length;
    const radius = Math.max(
      ...connected.map((n) =>
        Math.hypot(graph.getNodeAttribute(n, 'x') - cx, graph.getNodeAttribute(n, 'y') - cy),
      ),
    );
    for (const isolate of ['color.unused', 'spacing.md']) {
      const distance = Math.hypot(
        graph.getNodeAttribute(isolate, 'x') - cx,
        graph.getNodeAttribute(isolate, 'y') - cy,
      );
      expect(distance).toBeGreaterThan(radius);
    }
  });

  it('keeps isolated tokens of one group together, apart from other groups', () => {
    const graph = buildViewerGraph(
      tokenGraphFrom({
        a: { x: { $value: 1 }, y: { $value: 2 }, z: { $value: 3 } },
        b: { x: { $value: 1 }, y: { $value: 2 } },
        linked: { p: { $value: 1 }, q: { $value: '{linked.p}' } },
      }),
    );
    layoutViewerGraph(graph);
    const d = (m: string, n: string) =>
      Math.hypot(
        graph.getNodeAttribute(m, 'x') - graph.getNodeAttribute(n, 'x'),
        graph.getNodeAttribute(m, 'y') - graph.getNodeAttribute(n, 'y'),
      );
    expect(d('a.x', 'a.y')).toBeLessThan(d('a.x', 'b.x'));
    expect(d('b.x', 'b.y')).toBeLessThan(d('b.x', 'a.z'));
  });

  it('lays out a graph with no edges at all without stacking nodes', () => {
    const graph = buildViewerGraph(
      tokenGraphFrom({ a: { $value: 1 }, b: { $value: 2 }, c: { $value: 3 } }),
    );
    layoutViewerGraph(graph);
    const positions = new Set<string>();
    graph.forEachNode((_, attrs) => positions.add(`${attrs.x},${attrs.y}`));
    expect(positions.size).toBe(3);
  });

  it('does nothing for an empty graph', () => {
    const graph = buildViewerGraph(tokenGraphFrom({}));
    expect(() => layoutViewerGraph(graph)).not.toThrow();
    expect(() => placeIsolatesAsSatellites(graph)).not.toThrow();
  });

  it('uses fewer iterations for bigger graphs', () => {
    expect(defaultIterations(50)).toBeGreaterThan(defaultIterations(500));
    expect(defaultIterations(500)).toBeGreaterThan(defaultIterations(5000));
  });
});

describe('viewerExtent', () => {
  it('is undefined for an empty graph', () => {
    expect(viewerExtent(buildViewerGraph(tokenGraphFrom({})))).toBeUndefined();
  });

  it('grows the box around a tiny graph so it is not stretched edge to edge', () => {
    const graph = buildViewerGraph(
      tokenGraphFrom({ a: { $type: 'color', $value: '#000' }, b: { $value: '{a}' } }),
    );
    layoutViewerGraph(graph);
    const extent = viewerExtent(graph);
    if (extent === undefined) throw new Error('expected an extent');
    const xs = graph.mapNodes((_, attrs) => attrs.x);
    const ys = graph.mapNodes((_, attrs) => attrs.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(extent.x[1] - extent.x[0]).toBeGreaterThan(span * 3);
    expect(extent.y[1] - extent.y[0]).toBe(extent.x[1] - extent.x[0]);
  });

  it('uses the exact bounds once the graph is big enough to fill the view', () => {
    const tokens: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) tokens[`t${i}`] = { $value: i };
    const graph = buildViewerGraph(tokenGraphFrom(tokens));
    layoutViewerGraph(graph);
    const extent = viewerExtent(graph);
    const xs = graph.mapNodes((_, attrs) => attrs.x);
    expect(extent?.x).toEqual([Math.min(...xs), Math.max(...xs)]);
  });
});
