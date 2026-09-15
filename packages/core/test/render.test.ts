import { describe, expect, it } from 'vitest';

import { buildTokenGraph } from '../src/graph.js';
import { renderTokenGraphToSvg } from '../src/render.js';
import type { TokenEdge, TokenNode } from '../src/types.js';

function token(path: string[], overrides: Partial<TokenNode> = {}): TokenNode {
  return {
    kind: 'token',
    name: path[path.length - 1] ?? '',
    path,
    value: '#000000',
    ...overrides,
  };
}

function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('renderTokenGraphToSvg', () => {
  it('renders a well-formed SVG document with a node per token', () => {
    const nodes = [token(['color', 'brand']), token(['color', 'accent'])];
    const edges: TokenEdge[] = [
      { from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' },
    ];
    const svg = renderTokenGraphToSvg(buildTokenGraph(nodes, edges));

    const doc = parseSvg(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('.dtgraph-node')).toHaveLength(2);
    expect(doc.querySelectorAll('.dtgraph-edge')).toHaveLength(1);
    expect(doc.querySelector('.dtgraph-node text')?.textContent).toBe('color.brand');
  });

  it('renders an empty graph as valid, if minimal, SVG', () => {
    const svg = renderTokenGraphToSvg(buildTokenGraph([], []));
    const doc = parseSvg(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('.dtgraph-node')).toHaveLength(0);
  });

  it('visually distinguishes composite-member edges from scalar alias edges', () => {
    const nodes = [token(['color', 'brand']), token(['border', 'accent'], { value: {} })];
    const edges: TokenEdge[] = [
      {
        from: ['border', 'accent'],
        to: ['color', 'brand'],
        reference: '{color.brand}',
        kind: 'composite-member',
        member: 'color',
      },
    ];
    const svg = renderTokenGraphToSvg(buildTokenGraph(nodes, edges));
    const doc = parseSvg(svg);

    const edgeGroup = doc.querySelector('.dtgraph-edge');
    expect(edgeGroup?.classList.contains('composite-member')).toBe(true);
    expect(edgeGroup?.querySelector('path')?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(edgeGroup?.querySelector('text')?.textContent).toBe('{color.brand} (color)');
  });

  it('never emits unescaped markup for a token with script-laced path/description/reference content', () => {
    const maliciousSegment = '<script>alert(1)</script>';
    const nodes = [
      token(['color', maliciousSegment], { description: '<img src=x onerror=alert(2)>' }),
      token(['color', 'accent'], { value: `{color.${maliciousSegment}}` }),
    ];
    const edges: TokenEdge[] = [
      {
        from: ['color', 'accent'],
        to: ['color', maliciousSegment],
        reference: `{color.${maliciousSegment}}`,
      },
    ];
    const svg = renderTokenGraphToSvg(buildTokenGraph(nodes, edges));

    // The raw payload must never appear as literal, unescaped markup in the output.
    expect(svg).not.toContain('<script>alert(1)</script>');
    expect(svg).not.toContain('<img src=x onerror=alert(2)>');
    // It's still present, but only as escaped text.
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

    const doc = parseSvg(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    expect(doc.querySelectorAll('img')).toHaveLength(0);
    const label = Array.from(doc.querySelectorAll('.dtgraph-node text')).find((el) =>
      el.textContent?.includes('script'),
    );
    expect(label?.textContent).toBe(`color.${maliciousSegment}`);
  });
});
