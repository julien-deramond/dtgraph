import { describe, expect, it } from 'vitest';

import {
  checkGraphComplexity,
  checkUploadComplexity,
  MAX_FILE_BYTES,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NODES,
  MAX_JSON_DEPTH,
  MAX_JSON_NODES,
  MAX_TOTAL_BYTES,
  UploadTooComplexError,
} from '../src/lib/upload-guard.js';

describe('checkUploadComplexity', () => {
  it('accepts a small, shallow file', () => {
    expect(() =>
      checkUploadComplexity([
        {
          source: 'tokens.json',
          content: JSON.stringify({ color: { brand: { $value: '#000' } } }),
        },
      ]),
    ).not.toThrow();
  });

  it('rejects a single file over the per-file byte limit', () => {
    const content = JSON.stringify({ padding: 'x'.repeat(MAX_FILE_BYTES) });
    expect(() => checkUploadComplexity([{ source: 'big.json', content }])).toThrow(
      UploadTooComplexError,
    );
  });

  it('rejects multiple files whose combined size exceeds the total byte limit', () => {
    const chunk = 'x'.repeat(MAX_FILE_BYTES - 100);
    const files = Array.from({ length: Math.ceil(MAX_TOTAL_BYTES / chunk.length) + 1 }, (_, i) => ({
      source: `file-${i}.json`,
      content: JSON.stringify({ padding: chunk }),
    }));
    expect(() => checkUploadComplexity(files)).toThrow(UploadTooComplexError);
    expect(() => checkUploadComplexity(files)).toThrow(/too large to render together/);
  });

  it('rejects JSON nested deeper than the depth limit', () => {
    let value: unknown = { $value: '#000' };
    for (let i = 0; i < MAX_JSON_DEPTH + 5; i++) {
      value = { nested: value };
    }
    expect(() =>
      checkUploadComplexity([{ source: 'deep.json', content: JSON.stringify(value) }]),
    ).toThrow(/nested too deeply/);
  });

  it('rejects JSON with more nodes than the node-count limit', () => {
    const wide: Record<string, unknown> = {};
    for (let i = 0; i < MAX_JSON_NODES + 10; i++) {
      wide[`token-${i}`] = { $value: i };
    }
    expect(() =>
      checkUploadComplexity([{ source: 'wide.json', content: JSON.stringify(wide) }]),
    ).toThrow(/too large or complex to render/);
  });

  it('leaves malformed JSON for @dtgraph/core to report', () => {
    expect(() =>
      checkUploadComplexity([{ source: 'broken.json', content: '{ not valid json' }]),
    ).not.toThrow();
  });
});

describe('checkGraphComplexity', () => {
  it('accepts a small graph', () => {
    expect(() => checkGraphComplexity(10, 5)).not.toThrow();
  });

  it('rejects a graph over the node-count limit', () => {
    expect(() => checkGraphComplexity(MAX_GRAPH_NODES + 1, 0)).toThrow(UploadTooComplexError);
  });

  it('rejects a graph over the edge-count limit', () => {
    expect(() => checkGraphComplexity(0, MAX_GRAPH_EDGES + 1)).toThrow(UploadTooComplexError);
  });
});
