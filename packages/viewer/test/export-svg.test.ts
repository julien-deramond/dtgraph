import { describe, expect, it } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import { renderViewerGraphToSvg } from '../src/export-svg.js';
import { layoutViewerGraph } from '../src/layout.js';
import { THEMES } from '../src/theme.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

function laidOut(document: unknown = SAMPLE): ReturnType<typeof buildViewerGraph> {
  const graph = buildViewerGraph(tokenGraphFrom(document));
  layoutViewerGraph(graph);
  return graph;
}

/** Every `<circle>`'s center, in document order. */
function circles(svg: string): { x: number; y: number; r: number }[] {
  return [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    r: Number(match[3]),
  }));
}

describe('renderViewerGraphToSvg', () => {
  it('draws one circle per token and one arrowhead per reference', () => {
    const graph = laidOut();
    const svg = renderViewerGraphToSvg(graph);
    expect(circles(svg)).toHaveLength(graph.order);
    expect([...svg.matchAll(/<polygon /g)]).toHaveLength(graph.size);
  });

  it("carries the viewer's own picture: positions, palette colors, blast-radius sizes", () => {
    const graph = laidOut();
    const svg = renderViewerGraphToSvg(graph);
    const drawn = circles(svg);

    // The primitive everything aliases is the biggest dot, and no two tokens share a position.
    const sizes = new Set(drawn.map((circle) => circle.r));
    expect(sizes.size).toBeGreaterThan(1);
    expect(new Set(drawn.map((circle) => `${circle.x},${circle.y}`)).size).toBe(drawn.length);

    // Colors come from the theme palette, not from a hardcoded pair.
    const fills = new Set([...svg.matchAll(/<circle [^>]*fill="([^"]+)"/g)].map((m) => m[1]));
    expect(fills.size).toBeGreaterThan(1);
    for (const fill of fills) expect(THEMES.dark.palette).toContain(fill);
  });

  it('frames the graph inside the padding, at the requested width', () => {
    const svg = renderViewerGraphToSvg(laidOut(), { width: 800, padding: 40 });
    expect(svg).toContain('width="800"');
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeGreaterThan(0);
    for (const circle of circles(svg)) {
      expect(circle.x).toBeGreaterThanOrEqual(40 - circle.r);
      expect(circle.x).toBeLessThanOrEqual(800 - 40 + circle.r);
      expect(circle.y).toBeGreaterThanOrEqual(40 - circle.r);
      expect(circle.y).toBeLessThanOrEqual(height - 40 + circle.r);
    }
  });

  it('paints the theme background, and the light theme when asked', () => {
    expect(renderViewerGraphToSvg(laidOut())).toContain(`fill="${THEMES.dark.background}"`);
    const light = renderViewerGraphToSvg(laidOut(), { theme: 'light' });
    expect(light).toContain(`fill="${THEMES.light.background}"`);
    expect(renderViewerGraphToSvg(laidOut(), { background: false })).not.toContain('<rect');
  });

  it('thins labels by default, labels everything on request, and can drop them', () => {
    const graph = laidOut();
    const count = (svg: string): number => [...svg.matchAll(/<text /g)].length;
    expect(count(renderViewerGraphToSvg(graph, { labels: 'all' }))).toBe(graph.order);
    expect(count(renderViewerGraphToSvg(graph, { labels: 'none' }))).toBe(0);
    const auto = count(renderViewerGraphToSvg(graph));
    expect(auto).toBeGreaterThan(0);
    expect(auto).toBeLessThanOrEqual(graph.order);
  });

  it('escapes token-derived text', () => {
    const graph = laidOut({ '<script>': { $value: '#000000' } });
    const svg = renderViewerGraphToSvg(graph, { labels: 'all' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('returns a well-formed, empty-but-valid document for an empty graph', () => {
    const svg = renderViewerGraphToSvg(buildViewerGraph(tokenGraphFrom({})));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(circles(svg)).toHaveLength(0);
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBe(
      null,
    );
  });

  it('parses as SVG, with the nodes painted over the edges', () => {
    const svg = renderViewerGraphToSvg(laidOut());
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBe(null);
    const groups = [...document.querySelectorAll('svg > g')].map((g) => g.getAttribute('class'));
    expect(groups).toEqual(['dtgraph-edges', 'dtgraph-nodes', 'dtgraph-labels']);
  });
});
