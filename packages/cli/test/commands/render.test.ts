import { DtcgParseError } from '@dtgraph/core';
import { describe, expect, it } from 'vitest';

import { renderTokenFilesToMermaid, renderTokenFilesToSvg } from '../../src/commands/render.js';

describe('renderTokenFilesToSvg', () => {
  it('renders a single valid token file to SVG', () => {
    const svg = renderTokenFilesToSvg([
      {
        source: 'tokens.json',
        content: JSON.stringify({
          color: {
            brand: { $type: 'color', $value: '#112233' },
            accent: { $value: '{color.brand}' },
          },
        }),
      },
    ]);

    expect(svg).toContain('<svg');
    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });

  it('resolves aliases across multiple files', () => {
    const svg = renderTokenFilesToSvg([
      {
        source: 'color.json',
        content: JSON.stringify({
          color: { brand: { $type: 'color', $value: '#112233' } },
        }),
      },
      {
        source: 'alias.json',
        content: JSON.stringify({
          color: { accent: { $value: '{color.brand}' } },
        }),
      },
    ]);

    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });

  it('propagates a dangling-alias error from core unmodified', () => {
    const files = [
      {
        source: 'tokens.json',
        content: JSON.stringify({
          color: { accent: { $value: '{color.nonexistent}' } },
        }),
      },
    ];

    expect(() => renderTokenFilesToSvg(files)).toThrow(DtcgParseError);
    expect(() => renderTokenFilesToSvg(files)).toThrow(/does not resolve to any known token/);
  });

  it('propagates a JSON syntax error unmodified', () => {
    const files = [{ source: 'tokens.json', content: '{ not valid json' }];
    expect(() => renderTokenFilesToSvg(files)).toThrow(SyntaxError);
  });
});

describe('renderTokenFilesToMermaid', () => {
  const files = [
    {
      source: 'tokens.json',
      content: JSON.stringify({
        color: {
          brand: { $type: 'color', $value: '#112233' },
          accent: { $value: '{color.brand}' },
        },
      }),
    },
  ];

  it('renders token files to a Mermaid flowchart', () => {
    const mermaid = renderTokenFilesToMermaid(files);

    expect(mermaid.split('\n')[0]).toBe('flowchart LR');
    expect(mermaid).toMatch(/subgraph g_color_\w+ \["color"\]/);
    expect(mermaid).toMatch(/t_color_accent_\w+ --> t_color_brand_\w+/);
    expect(mermaid).toContain('["brand"]');
  });

  it('labels nodes with their full path when asked', () => {
    expect(renderTokenFilesToMermaid(files, { fullPaths: true })).toContain('["color.brand"]');
  });

  it('wraps the diagram in a mermaid code fence when asked', () => {
    const fenced = renderTokenFilesToMermaid(files, { fence: true });

    expect(fenced.startsWith('```mermaid\nflowchart LR\n')).toBe(true);
    expect(fenced.endsWith('\n```')).toBe(true);
    expect(fenced).toContain(renderTokenFilesToMermaid(files));
  });
});
