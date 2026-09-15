import { DtcgParseError } from '@dtgraph/core';
import type { TokenGraph } from '@dtgraph/core';
import { describe, expect, it, vi } from 'vitest';

import {
  buildTokenGraphFromFiles,
  createPlayground,
  readFiles,
  renderTokenFilesToSvg,
} from '../src/lib/playground.js';
import { MAX_FILE_BYTES, UploadTooComplexError } from '../src/lib/upload-guard.js';

const VALID = {
  source: 'tokens.json',
  content: JSON.stringify({
    color: {
      brand: { $type: 'color', $value: '#112233' },
      accent: { $value: '{color.brand}' },
    },
  }),
};

describe('buildTokenGraphFromFiles', () => {
  it('parses and resolves a single valid token file', () => {
    const graph = buildTokenGraphFromFiles([VALID]);
    expect(graph.nodes.map((node) => node.path.join('.'))).toEqual(['color.brand', 'color.accent']);
    expect(graph.edges).toHaveLength(1);
  });

  it('resolves aliases across multiple files', () => {
    const graph = buildTokenGraphFromFiles([
      {
        source: 'color.json',
        content: JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
      },
      {
        source: 'alias.json',
        content: JSON.stringify({ color: { accent: { $value: '{color.brand}' } } }),
      },
    ]);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.getOutgoingEdges(['color', 'accent'])).toHaveLength(1);
  });

  it('propagates a dangling-alias error from core unmodified', () => {
    const files = [
      {
        source: 'tokens.json',
        content: JSON.stringify({ color: { accent: { $value: '{color.nonexistent}' } } }),
      },
    ];

    expect(() => buildTokenGraphFromFiles(files)).toThrow(DtcgParseError);
    expect(() => buildTokenGraphFromFiles(files)).toThrow(/does not resolve to any known token/);
  });

  it('propagates a JSON syntax error unmodified', () => {
    expect(() =>
      buildTokenGraphFromFiles([{ source: 'tokens.json', content: '{ not valid json' }]),
    ).toThrow(SyntaxError);
  });

  it('rejects an oversized upload before it ever reaches @dtgraph/core', () => {
    const content = JSON.stringify({ padding: 'x'.repeat(MAX_FILE_BYTES) });
    expect(() => buildTokenGraphFromFiles([{ source: 'big.json', content }])).toThrow(
      UploadTooComplexError,
    );
  });
});

describe('renderTokenFilesToSvg', () => {
  it('renders the static SVG export', () => {
    const svg = renderTokenFilesToSvg([VALID]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });
});

describe('readFiles', () => {
  it('reads File objects via the browser File API', async () => {
    const file = new File(['{"color":{}}'], 'tokens.json', { type: 'application/json' });
    const result = await readFiles([file]);
    expect(result).toEqual([{ source: 'tokens.json', content: '{"color":{}}' }]);
  });
});

describe('createPlayground', () => {
  function setup() {
    const els = { output: document.createElement('div'), error: document.createElement('p') };
    const destroy = vi.fn();
    const mount = vi.fn((container: HTMLElement, graph: TokenGraph) => {
      const marker = document.createElement('div');
      marker.dataset.tokens = String(graph.nodes.length);
      container.appendChild(marker);
      return { destroy };
    });
    return { els, mount, destroy, playground: createPlayground(els, mount) };
  }

  it('mounts the resolved graph into the output element on success', () => {
    const { els, mount, playground } = setup();

    expect(playground.load([VALID])).toBe(true);

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0][0]).toBe(els.output);
    expect(els.output.querySelector('[data-tokens="2"]')).not.toBeNull();
    expect(els.error.hidden).toBe(true);
    expect(els.error.textContent).toBe('');
    expect(playground.graph?.nodes).toHaveLength(2);
    expect(playground.files).toEqual([VALID]);
  });

  it('tears down the previous graph before mounting the next one', () => {
    const { els, mount, destroy, playground } = setup();
    playground.load([VALID]);
    playground.load([VALID]);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(els.output.children).toHaveLength(1);
  });

  it('shows the error as plain text and keeps what was on screen on failure', () => {
    const { els, destroy, playground } = setup();
    playground.load([VALID]);

    expect(playground.load([{ source: 'tokens.json', content: '{ not valid json' }])).toBe(false);

    expect(els.error.hidden).toBe(false);
    expect(els.error.textContent).toContain('JSON');
    expect(destroy).not.toHaveBeenCalled();
    expect(els.output.children).toHaveLength(1);
    expect(playground.files).toEqual([VALID]);
  });

  it('remounts the current graph with the same output element', () => {
    const { els, mount, destroy, playground } = setup();
    playground.load([VALID]);
    playground.remount();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1][0]).toBe(els.output);
    expect(mount.mock.calls[1][1]).toBe(playground.graph);
  });

  it('exports the static SVG for the current graph only', () => {
    const { playground } = setup();
    expect(playground.exportSvg()).toBeUndefined();
    playground.load([VALID]);
    expect(playground.exportSvg()).toContain('<svg');
  });

  it('never lets script-laced token content become live markup, in errors or exports', () => {
    const { els, playground } = setup();
    const maliciousSegment = '<script>window.__pwned = true</script>';

    // Error messages quote the offending token path.
    playground.load([
      {
        source: 'tokens.json',
        content: JSON.stringify({
          color: { [maliciousSegment]: { $value: '{color.nonexistent}' } },
        }),
      },
    ]);
    expect(els.error.textContent).toContain(maliciousSegment);
    expect(els.error.querySelectorAll('script')).toHaveLength(0);

    // The SVG export escapes it.
    playground.load([
      {
        source: 'tokens.json',
        content: JSON.stringify({
          color: { [maliciousSegment]: { $type: 'color', $value: '#112233' } },
        }),
      },
    ]);
    const svg = playground.exportSvg() ?? '';
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('destroy clears everything', () => {
    const { els, destroy, playground } = setup();
    playground.load([VALID]);
    playground.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(els.output.children).toHaveLength(0);
    expect(playground.graph).toBeUndefined();
    expect(playground.files).toEqual([]);
  });
});
