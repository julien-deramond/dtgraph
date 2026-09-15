import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DtcgParseError } from '../src/errors.js';
import { parseTokenTree } from '../src/parse.js';
import type { GroupNode, TokenNode } from '../src/types.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(category: 'valid' | 'invalid', file: string): unknown {
  const raw = readFileSync(join(fixturesDir, category, file), 'utf8');
  return JSON.parse(raw);
}

describe('parseTokenTree', () => {
  it('parses nested groups and tokens', () => {
    const tree = parseTokenTree(loadFixture('valid', 'basic-colors.json')) as GroupNode;

    expect(tree.kind).toBe('group');
    const colors = tree.children.colors as GroupNode;
    expect(colors.kind).toBe('group');
    expect(colors.description).toBe('Core color palette');

    const red = colors.children.red as TokenNode;
    expect(red.kind).toBe('token');
    expect(red.value).toBe('#ff0000');
    expect(red.description).toBe('A pure red');
    expect(red.path).toEqual(['colors', 'red']);
  });

  it('inherits $type from the nearest ancestor group that declares one', () => {
    const tree = parseTokenTree(loadFixture('valid', 'type-inheritance.json')) as GroupNode;
    const space = tree.children.space as GroupNode;
    const responsive = space.children.responsive as GroupNode;

    expect(space.type).toBe('dimension');
    // Nested group inherits nothing of its own — it doesn't declare $type.
    expect(responsive.type).toBeUndefined();

    const small = space.children.small as TokenNode;
    expect(small.type).toBe('dimension');

    const large = responsive.children.large as TokenNode;
    expect(large.type).toBe('dimension');

    const compact = responsive.children.compact as TokenNode;
    expect(compact.type).toBe('dimension');
  });

  it('surfaces $description and $extensions, and leaves alias references unresolved', () => {
    const tree = parseTokenTree(loadFixture('valid', 'alias-and-extensions.json')) as GroupNode;
    const color = tree.children.color as GroupNode;

    const brand = color.children.brand as TokenNode;
    expect(brand.extensions).toEqual({ 'com.example.tool': { foo: 'bar' } });

    const accent = color.children.accent as TokenNode;
    expect(accent.value).toBe('{color.brand}');
    expect(accent.type).toBeUndefined();
  });

  it('treats a document whose root has $value as a single token', () => {
    const tree = parseTokenTree(loadFixture('valid', 'root-level-token.json')) as TokenNode;
    expect(tree.kind).toBe('token');
    expect(tree.value).toBe('#ff0000');
    expect(tree.path).toEqual([]);
  });

  it('rejects a token that also declares child properties', () => {
    expect(() => parseTokenTree(loadFixture('invalid', 'token-with-children.json'))).toThrow(
      DtcgParseError,
    );
    expect(() => parseTokenTree(loadFixture('invalid', 'token-with-children.json'))).toThrow(
      /cannot also contain child tokens or groups/,
    );
  });

  it('rejects a non-string $type', () => {
    expect(() => parseTokenTree(loadFixture('invalid', 'bad-type.json'))).toThrow(
      /"\$type" must be a non-empty string/,
    );
  });

  it('rejects a child that is not an object', () => {
    expect(() => parseTokenTree(loadFixture('invalid', 'non-object-child.json'))).toThrow(
      /must be an object \(a token or a group\)/,
    );
  });

  it('rejects a document whose root is not an object', () => {
    expect(() => parseTokenTree(loadFixture('invalid', 'root-not-object.json'))).toThrow(
      /must be a JSON object/,
    );
  });

  it('includes a spec reference in parse errors', () => {
    try {
      parseTokenTree(loadFixture('invalid', 'bad-type.json'));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DtcgParseError);
      expect((error as DtcgParseError).specReference).toContain('tr.designtokens.org');
    }
  });
});
