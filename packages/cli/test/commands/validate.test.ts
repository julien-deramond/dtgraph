import { describe, expect, it } from 'vitest';

import { validateTokenFiles } from '../../src/commands/validate.js';

describe('validateTokenFiles', () => {
  it('reports ok with token/edge counts for a valid set of files', () => {
    const result = validateTokenFiles([
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

    expect(result).toEqual({ ok: true, files: ['tokens.json'], tokenCount: 2, edgeCount: 1 });
  });

  it('reports a dangling alias as a structured, non-ok result', () => {
    const result = validateTokenFiles([
      {
        source: 'tokens.json',
        content: JSON.stringify({ color: { accent: { $value: '{color.nonexistent}' } } }),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.files).toEqual(['tokens.json']);
    expect(result.error?.message).toMatch(/does not resolve to any known token/);
    expect(result.error?.path).toEqual(['color', 'accent']);
    expect(result.error?.specReference).toContain('aliases-references');
  });

  it('reports an alias cycle as a structured, non-ok result', () => {
    const result = validateTokenFiles([
      {
        source: 'tokens.json',
        content: JSON.stringify({
          color: { a: { $value: '{color.b}' }, b: { $value: '{color.a}' } },
        }),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/Alias cycle detected/);
  });

  it('reports malformed JSON as a non-ok result without a DTCG path/specReference', () => {
    const result = validateTokenFiles([{ source: 'tokens.json', content: '{ not valid json' }]);

    expect(result.ok).toBe(false);
    expect(result.error?.path).toBeUndefined();
    expect(result.error?.specReference).toBeUndefined();
  });
});
