import { DtcgParseError } from '@dtgraph/core';
import { describe, expect, it } from 'vitest';

import { buildStoryTokenGraph, renderStoryTokensToSvg } from '../src/render-story-graph.js';

describe('renderStoryTokensToSvg', () => {
  it('renders a single token document to SVG', () => {
    const svg = renderStoryTokensToSvg({
      color: {
        brand: { $type: 'color', $value: '#112233' },
        accent: { $value: '{color.brand}' },
      },
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });

  it('resolves aliases across multiple token documents', () => {
    const svg = renderStoryTokensToSvg([
      { color: { brand: { $type: 'color', $value: '#112233' } } },
      { color: { accent: { $value: '{color.brand}' } } },
    ]);

    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });

  it('propagates a dangling-alias error from core unmodified', () => {
    const tokens = { color: { accent: { $value: '{color.nonexistent}' } } };

    expect(() => renderStoryTokensToSvg(tokens)).toThrow(DtcgParseError);
    expect(() => renderStoryTokensToSvg(tokens)).toThrow(/does not resolve to any known token/);
  });

  it('rejects two documents that collide on the same token path', () => {
    const tokens = [
      { color: { brand: { $type: 'color', $value: '#111111' } } },
      { color: { brand: { $type: 'color', $value: '#222222' } } },
    ];

    expect(() => renderStoryTokensToSvg(tokens)).toThrow(/is defined in both/);
  });
});

describe('buildStoryTokenGraph', () => {
  it('returns the resolved graph the panel mounts', () => {
    const graph = buildStoryTokenGraph({
      color: {
        brand: { $type: 'color', $value: '#112233' },
        accent: { $value: '{color.brand}' },
      },
    });
    expect(graph.nodes.map((node) => node.path.join('.'))).toEqual(['color.brand', 'color.accent']);
    expect(graph.getOutgoingEdges(['color', 'accent'])).toHaveLength(1);
  });

  it('resolves aliases across multiple documents', () => {
    const graph = buildStoryTokenGraph([
      { color: { brand: { $type: 'color', $value: '#112233' } } },
      { color: { accent: { $value: '{color.brand}' } } },
    ]);
    expect(graph.edges).toHaveLength(1);
  });

  it('propagates a dangling-alias error unmodified', () => {
    expect(() => buildStoryTokenGraph({ color: { accent: { $value: '{color.nope}' } } })).toThrow(
      DtcgParseError,
    );
  });
});
