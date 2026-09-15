import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DtcgParseError } from '../src/errors.js';
import { parseTokenTree } from '../src/parse.js';
import { resolveAliasEdges } from '../src/resolve.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(category: 'valid' | 'invalid', file: string): unknown {
  const raw = readFileSync(join(fixturesDir, category, file), 'utf8');
  return JSON.parse(raw);
}

describe('resolveAliasEdges', () => {
  it('resolves a simple alias to its target token', () => {
    const tree = parseTokenTree(loadFixture('valid', 'alias-and-extensions.json'));
    const edges = resolveAliasEdges(tree);

    expect(edges).toEqual([
      { from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' },
    ]);
  });

  it('resolves an alias-to-alias chain as separate single-hop edges', () => {
    const tree = parseTokenTree(loadFixture('valid', 'alias-chain.json'));
    const edges = resolveAliasEdges(tree);

    expect(edges).toContainEqual({
      from: ['color', 'top'],
      to: ['color', 'mid'],
      reference: '{color.mid}',
    });
    expect(edges).toContainEqual({
      from: ['color', 'mid'],
      to: ['color', 'base'],
      reference: '{color.base}',
    });
    // The chain isn't collapsed — there's no direct top -> base edge.
    expect(edges).not.toContainEqual(
      expect.objectContaining({ from: ['color', 'top'], to: ['color', 'base'] }),
    );
  });

  it('rejects an alias that does not resolve to a known token', () => {
    const tree = parseTokenTree(loadFixture('invalid', 'dangling-alias.json'));

    expect(() => resolveAliasEdges(tree)).toThrow(DtcgParseError);
    expect(() => resolveAliasEdges(tree)).toThrow(
      /Alias "\{color\.nonexistent\}" does not resolve to any known token/,
    );
  });

  it('includes the referencing token path and a spec reference in the error', () => {
    const tree = parseTokenTree(loadFixture('invalid', 'dangling-alias.json'));

    try {
      resolveAliasEdges(tree);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DtcgParseError);
      expect((error as DtcgParseError).path).toEqual(['color', 'accent']);
      expect((error as DtcgParseError).specReference).toContain('aliases-references');
    }
  });

  it('produces no edges for a tree with no aliases', () => {
    const tree = parseTokenTree(loadFixture('valid', 'basic-colors.json'));
    expect(resolveAliasEdges(tree)).toEqual([]);
  });
});
