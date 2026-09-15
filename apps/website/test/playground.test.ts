import { DtcgParseError } from '@dtgraph/core';
import { describe, expect, it } from 'vitest';

import { readFiles, renderFilesToDom, renderTokenFilesToSvg } from '../src/lib/playground.js';
import { MAX_FILE_BYTES, UploadTooComplexError } from '../src/lib/upload-guard.js';

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
        content: JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
      },
      {
        source: 'alias.json',
        content: JSON.stringify({ color: { accent: { $value: '{color.brand}' } } }),
      },
    ]);

    expect(svg).toContain('color.brand');
    expect(svg).toContain('color.accent');
  });

  it('propagates a dangling-alias error from core unmodified', () => {
    const files = [
      {
        source: 'tokens.json',
        content: JSON.stringify({ color: { accent: { $value: '{color.nonexistent}' } } }),
      },
    ];

    expect(() => renderTokenFilesToSvg(files)).toThrow(DtcgParseError);
    expect(() => renderTokenFilesToSvg(files)).toThrow(/does not resolve to any known token/);
  });

  it('propagates a JSON syntax error unmodified', () => {
    expect(() =>
      renderTokenFilesToSvg([{ source: 'tokens.json', content: '{ not valid json' }]),
    ).toThrow(SyntaxError);
  });

  it('rejects an oversized upload before it ever reaches @dtgraph/core', () => {
    const content = JSON.stringify({ padding: 'x'.repeat(MAX_FILE_BYTES) });
    expect(() => renderTokenFilesToSvg([{ source: 'big.json', content }])).toThrow(
      UploadTooComplexError,
    );
  });
});

describe('readFiles', () => {
  it('reads File objects via the browser File API', async () => {
    const file = new File(['{"color":{}}'], 'tokens.json', { type: 'application/json' });
    const result = await readFiles([file]);
    expect(result).toEqual([{ source: 'tokens.json', content: '{"color":{}}' }]);
  });
});

describe('renderFilesToDom', () => {
  function makeElements() {
    return { output: document.createElement('div'), error: document.createElement('p') };
  }

  it('injects the rendered SVG into the output element on success', () => {
    const els = makeElements();
    renderFilesToDom(
      [
        {
          source: 'tokens.json',
          content: JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
        },
      ],
      els,
    );

    expect(els.output.innerHTML).toContain('<svg');
    expect(els.error.textContent).toBe('');
  });

  it('shows the error message as plain text and clears output on failure', () => {
    const els = makeElements();
    els.output.innerHTML = '<svg>stale</svg>';

    renderFilesToDom([{ source: 'tokens.json', content: '{ not valid json' }], els);

    expect(els.output.innerHTML).toBe('');
    expect(els.error.textContent).toContain('JSON');
  });

  it('never lets script-laced token content become live markup in the DOM', () => {
    const els = makeElements();
    const maliciousSegment = '<script>window.__pwned = true</script>';
    renderFilesToDom(
      [
        {
          source: 'tokens.json',
          content: JSON.stringify({
            color: { [maliciousSegment]: { $type: 'color', $value: '#112233' } },
          }),
        },
      ],
      els,
    );

    expect(els.output.querySelectorAll('script')).toHaveLength(0);
    expect(els.output.innerHTML).not.toContain('<script>window.__pwned = true</script>');
    expect(els.output.textContent).toContain(maliciousSegment);
  });
});
