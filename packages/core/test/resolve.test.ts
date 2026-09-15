import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DtcgParseError } from '../src/errors.js';
import { parseTokenTree } from '../src/parse.js';
import { resolveAliasEdges, resolveAliasEdgesAcrossFiles } from '../src/resolve.js';

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

  it('rejects a direct alias cycle (A -> B -> A)', () => {
    const tree = parseTokenTree(loadFixture('invalid', 'alias-cycle-direct.json'));

    expect(() => resolveAliasEdges(tree)).toThrow(DtcgParseError);
    expect(() => resolveAliasEdges(tree)).toThrow(
      /Alias cycle detected: color\.a → color\.b → color\.a/,
    );
  });

  it('rejects an indirect alias cycle (A -> B -> C -> A)', () => {
    const tree = parseTokenTree(loadFixture('invalid', 'alias-cycle-indirect.json'));

    expect(() => resolveAliasEdges(tree)).toThrow(DtcgParseError);
    expect(() => resolveAliasEdges(tree)).toThrow(
      /Alias cycle detected: color\.a → color\.b → color\.c → color\.a/,
    );
  });

  it('resolves a member-level alias inside an object composite value', () => {
    const tree = parseTokenTree(loadFixture('valid', 'composite-typography.json'));
    const edges = resolveAliasEdges(tree);

    expect(edges).toEqual([
      {
        from: ['type', 'heading'],
        to: ['font', 'family'],
        reference: '{font.family}',
        kind: 'composite-member',
        member: 'fontFamily',
      },
    ]);
  });

  it('resolves member-level aliases inside an array composite value, including nested object elements', () => {
    const tree = parseTokenTree(loadFixture('valid', 'composite-shadow-layered.json'));
    const edges = resolveAliasEdges(tree);

    expect(edges).toContainEqual({
      from: ['shadow', 'base'],
      to: ['color', 'shadow-tint'],
      reference: '{color.shadow-tint}',
      kind: 'composite-member',
      member: 'color',
    });
    expect(edges).toContainEqual({
      from: ['shadow', 'layered'],
      to: ['shadow', 'base'],
      reference: '{shadow.base}',
      kind: 'composite-member',
      member: '[0]',
    });
    expect(edges).toContainEqual({
      from: ['shadow', 'layered'],
      to: ['color', 'shadow-tint'],
      reference: '{color.shadow-tint}',
      kind: 'composite-member',
      member: '[1].color',
    });
  });

  it('rejects a composite-member alias that does not resolve to a known token', () => {
    const tree = parseTokenTree(loadFixture('invalid', 'dangling-composite-alias.json'));

    expect(() => resolveAliasEdges(tree)).toThrow(DtcgParseError);
    expect(() => resolveAliasEdges(tree)).toThrow(
      /Alias "\{color\.nonexistent\}" does not resolve to any known token/,
    );

    try {
      resolveAliasEdges(tree);
      expect.unreachable();
    } catch (error) {
      expect((error as DtcgParseError).path).toEqual(['border', 'focusring']);
    }
  });
});

describe('resolveAliasEdgesAcrossFiles', () => {
  function loadNamedTree(category: 'valid' | 'invalid', file: string) {
    return { source: file, tree: parseTokenTree(loadFixture(category, file)) };
  }

  it('resolves a scalar alias that points at a token defined in another file', () => {
    const files = [
      loadNamedTree('valid', 'cross-file-color.json'),
      loadNamedTree('valid', 'cross-file-spacing.json'),
      loadNamedTree('valid', 'cross-file-border.json'),
    ];
    const edges = resolveAliasEdgesAcrossFiles(files);

    expect(edges).toContainEqual({
      from: ['color', 'accent-alias'],
      to: ['color', 'brand'],
      reference: '{color.brand}',
    });
  });

  it('resolves a composite-member alias that points across files', () => {
    const files = [
      loadNamedTree('valid', 'cross-file-color.json'),
      loadNamedTree('valid', 'cross-file-spacing.json'),
      loadNamedTree('valid', 'cross-file-border.json'),
    ];
    const edges = resolveAliasEdgesAcrossFiles(files);

    expect(edges).toContainEqual({
      from: ['border', 'accent'],
      to: ['color', 'brand'],
      reference: '{color.brand}',
      kind: 'composite-member',
      member: 'color',
    });
    expect(edges).toContainEqual({
      from: ['border', 'accent'],
      to: ['spacing', 'small'],
      reference: '{spacing.small}',
      kind: 'composite-member',
      member: 'width',
    });
  });

  it('rejects two files that define the same token path', () => {
    const files = [
      loadNamedTree('invalid', 'cross-file-collision-a.json'),
      loadNamedTree('invalid', 'cross-file-collision-b.json'),
    ];

    expect(() => resolveAliasEdgesAcrossFiles(files)).toThrow(DtcgParseError);
    expect(() => resolveAliasEdgesAcrossFiles(files)).toThrow(
      /Token "color\.brand" is defined in both "cross-file-collision-a\.json" and "cross-file-collision-b\.json"/,
    );
  });
});
