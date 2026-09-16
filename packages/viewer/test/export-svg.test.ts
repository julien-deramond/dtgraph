import { describe, expect, it } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import { renderViewerGraphToSvg } from '../src/export-svg.js';
import { layoutViewerGraph } from '../src/layout.js';
import { fadeTowards } from '../src/palette.js';
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

/** Every node fill in the document, keyed by the token the `<title>` names. */
function fillByToken(svg: string): Map<string, string> {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const fills = new Map<string, string>();
  for (const circle of document.querySelectorAll('.dtgraph-nodes circle')) {
    fills.set(circle.querySelector('title')?.textContent ?? '', circle.getAttribute('fill') ?? '');
  }
  return fills;
}

/** The tokens carrying a label, in paint order. */
function labelledTokens(svg: string, graph: ReturnType<typeof buildViewerGraph>): string[] {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const labels = new Set(
    [...document.querySelectorAll('.dtgraph-labels text')].map((text) => text.textContent),
  );
  return graph.nodes().filter((node) => labels.has(graph.getNodeAttribute(node, 'label')));
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

  describe('emphasis', () => {
    // `button.background` → `semantic.primary` → `color.blue` is the one chain in the sample:
    // selecting the middle of it lights three tokens and dims everything else.
    const CHAIN = ['semantic.primary', 'color.blue', 'button.background'];

    it('lights the selection and its chains, and fades the rest, like the canvas', () => {
      const graph = laidOut();
      const fills = fillByToken(
        renderViewerGraphToSvg(graph, { emphasis: { selected: 'semantic.primary' } }),
      );
      expect(fills.size).toBe(graph.order);
      for (const [token, fill] of fills) {
        const own = graph.getNodeAttribute(token, 'color');
        if (CHAIN.includes(token)) expect(fill).toBe(own);
        else
          expect(fill).toBe(
            fadeTowards(own, THEMES.dark.background, THEMES.dark.fadedNodeStrength),
          );
      }
    });

    it('rings the selected token, and nothing when there is no selection', () => {
      const svg = renderViewerGraphToSvg(laidOut(), { emphasis: { selected: 'semantic.primary' } });
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const rings = [...document.querySelectorAll('.dtgraph-selection circle')];
      expect(rings).toHaveLength(1);
      expect(rings[0]?.getAttribute('stroke')).toBe(THEMES.dark.hoverRing);

      // The ring sits over the dot it belongs to, one radius wider.
      const dot = [...document.querySelectorAll('.dtgraph-nodes circle')].find(
        (circle) => circle.querySelector('title')?.textContent === 'semantic.primary',
      );
      expect(rings[0]?.getAttribute('cx')).toBe(dot?.getAttribute('cx'));

      expect(renderViewerGraphToSvg(laidOut(), { emphasis: {} })).not.toContain(
        'dtgraph-selection',
      );
    });

    it('labels the whole spotlight and drops the labels of what it dims', () => {
      const graph = laidOut();
      const labelled = labelledTokens(
        renderViewerGraphToSvg(graph, { emphasis: { selected: 'semantic.primary' } }),
        graph,
      );
      // The selection and its direct neighbors are labelled whatever the label grid says, and
      // nothing outside the spotlight is labelled at all.
      expect(labelled.sort()).toEqual([...CHAIN].sort());
    });

    it('draws lit edges last, at full color, over the faded texture', () => {
      const svg = renderViewerGraphToSvg(laidOut(), { emphasis: { selected: 'semantic.primary' } });
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const lines = [...document.querySelectorAll('.dtgraph-edges line')];
      const lit = lines.filter((line) => line.getAttribute('stroke-width') === '1.6');
      expect(lit).toHaveLength(2);
      // Both chain edges come after every other edge in paint order.
      const litFrom = lines.indexOf(lit[0] as Element);
      expect(litFrom).toBe(lines.length - 2);
    });

    it('shows one legend category alone when solo is set', () => {
      const graph = laidOut();
      const fills = fillByToken(
        renderViewerGraphToSvg(graph, {
          emphasis: { solo: 'color', categoryOf: (node) => graph.getNodeAttribute(node, 'group') },
        }),
      );
      for (const [token, fill] of fills) {
        const lit = graph.getNodeAttribute(token, 'group') === 'color';
        expect(fill === graph.getNodeAttribute(token, 'color')).toBe(lit);
      }
    });

    it('names the focused token in the accessible title', () => {
      expect(
        renderViewerGraphToSvg(laidOut(), { emphasis: { selected: 'semantic.primary' } }),
      ).toContain('focused on semantic.primary</title>');
      expect(renderViewerGraphToSvg(laidOut())).not.toContain('focused on');
    });

    it('draws the map at rest for an unknown selection, or none at all', () => {
      const atRest = renderViewerGraphToSvg(laidOut());
      expect(renderViewerGraphToSvg(laidOut(), { emphasis: {} })).toBe(atRest);
      expect(renderViewerGraphToSvg(laidOut(), { emphasis: { selected: 'nope' } })).toBe(atRest);
    });
  });
});
