import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DtcgParseError } from '../src/errors.js';
import {
  buildTokenGraphFromDocuments,
  buildTokenGraphFromResolver,
  isResolverDocument,
  parseResolverDocument,
} from '../src/resolver.js';
import type { ResolverFileInput, TokenDocumentInput } from '../src/resolver.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'resolver');

function loadJson(file: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));
}

/** The fixture files as they would be passed from disk, with paths relative to the fixtures dir. */
function fixtureFiles(): TokenDocumentInput[] {
  return [
    'ds.resolver.json',
    'base.json',
    'themes/light.json',
    'themes/dark.json',
    'components.json',
  ].map((file) => ({ source: file, document: loadJson(file) }));
}

/** The same files as a browser would hand them over: file names only, no directories. */
function fixtureFilesByName(): TokenDocumentInput[] {
  return fixtureFiles().map((file) => ({ ...file, source: file.source.replace(/^.*\//, '') }));
}

const RESOLVER = loadJson('ds.resolver.json');

function resolverWith(patch: Record<string, unknown>): unknown {
  return { ...(RESOLVER as Record<string, unknown>), ...patch };
}

function tokenFiles(): ResolverFileInput[] {
  return fixtureFiles().filter((file) => file.source !== 'ds.resolver.json');
}

function expectParseError(fn: () => unknown, message: RegExp, specFragment: string): void {
  expect(fn).toThrow(DtcgParseError);
  try {
    fn();
    expect.unreachable();
  } catch (error) {
    expect((error as DtcgParseError).message).toMatch(message);
    expect((error as DtcgParseError).specReference).toContain(specFragment);
  }
}

describe('isResolverDocument', () => {
  it('recognizes an object with a resolutionOrder array', () => {
    expect(isResolverDocument(RESOLVER)).toBe(true);
    expect(isResolverDocument({ resolutionOrder: [] })).toBe(true);
  });

  it('does not mistake token files or scalars for a resolver', () => {
    expect(isResolverDocument(loadJson('base.json'))).toBe(false);
    expect(isResolverDocument({ resolutionOrder: { $value: 1 } })).toBe(false);
    expect(isResolverDocument(null)).toBe(false);
    expect(isResolverDocument('resolutionOrder')).toBe(false);
  });
});

describe('parseResolverDocument', () => {
  it('parses sets, modifiers and a resolution order of same-document references', () => {
    const resolver = parseResolverDocument(RESOLVER);

    expect(resolver.name).toBe('Design system');
    expect(resolver.version).toBe('2025.10');
    expect(Object.keys(resolver.sets)).toEqual(['base', 'components']);
    expect(resolver.sets.base.sources).toEqual([
      {
        kind: 'ref',
        ref: 'base.json',
        overrides: undefined,
        location: ['sets', 'base', 'sources', '0'],
      },
    ]);
    expect(resolver.modifiers.theme.default).toBe('light');
    expect(Object.keys(resolver.modifiers.theme.contexts)).toEqual(['light', 'dark']);
    expect(resolver.resolutionOrder.map((entry) => entry.kind)).toEqual(['set', 'modifier', 'set']);
    expect(resolver.resolutionOrder[1]).toEqual({
      kind: 'modifier',
      modifier: resolver.modifiers.theme,
    });
  });

  it('parses inline sets and modifiers declared directly in the resolution order', () => {
    const resolver = parseResolverDocument({
      version: '2025.10',
      resolutionOrder: [
        {
          type: 'set',
          name: 'inline-base',
          sources: [{ color: { a: { $type: 'color', $value: '#000' } } }],
        },
        {
          type: 'modifier',
          name: 'density',
          contexts: { compact: [], comfortable: [] },
          default: 'compact',
        },
      ],
    });

    expect(resolver.resolutionOrder[0]).toMatchObject({
      kind: 'set',
      set: { name: 'inline-base' },
    });
    expect(resolver.resolutionOrder[1]).toMatchObject({
      kind: 'modifier',
      modifier: { name: 'density', default: 'compact' },
    });
  });

  it('keeps keys declared next to $ref as overrides', () => {
    const resolver = parseResolverDocument({
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'base.json', color: { extra: { $value: '#fff' } } }] } },
      resolutionOrder: [{ $ref: '#/sets/base' }],
    });
    expect(resolver.sets.base.sources[0]).toMatchObject({
      kind: 'ref',
      ref: 'base.json',
      overrides: { color: { extra: { $value: '#fff' } } },
    });
  });

  it('rejects a document that is not an object', () => {
    expectParseError(
      () => parseResolverDocument([]),
      /must be a JSON object, got an array/,
      'root-level-properties',
    );
  });

  it('rejects a missing or unsupported version', () => {
    expectParseError(
      () => parseResolverDocument(resolverWith({ version: undefined })),
      /must declare a "version"/,
      '#version',
    );
    expectParseError(
      () => parseResolverDocument(resolverWith({ version: '2024.01' })),
      /Unsupported resolver version "2024.01"/,
      '#version',
    );
  });

  it('rejects a missing resolutionOrder', () => {
    expectParseError(
      () => parseResolverDocument(resolverWith({ resolutionOrder: undefined })),
      /must declare a "resolutionOrder" array/,
      'resolution-order',
    );
  });

  it('rejects a resolution order reference to an undeclared set or modifier', () => {
    expectParseError(
      () => parseResolverDocument(resolverWith({ resolutionOrder: [{ $ref: '#/sets/nope' }] })),
      /"#\/sets\/nope" does not point to a declared set/,
      'invalid-pointers',
    );
    expectParseError(
      () =>
        parseResolverDocument(resolverWith({ resolutionOrder: [{ $ref: '#/modifiers/nope' }] })),
      /does not point to a declared modifier/,
      'invalid-pointers',
    );
    expectParseError(
      () =>
        parseResolverDocument(resolverWith({ resolutionOrder: [{ $ref: '#/resolutionOrder/0' }] })),
      /must point to "#\/sets\/<name>" or "#\/modifiers\/<name>"/,
      'invalid-pointers',
    );
  });

  it('rejects a modifier without contexts or whose default is not a context', () => {
    expectParseError(
      () => parseResolverDocument(resolverWith({ modifiers: { theme: { default: 'light' } } })),
      /must declare a "contexts" object/,
      '#contexts',
    );
    expectParseError(
      () =>
        parseResolverDocument(
          resolverWith({ modifiers: { theme: { contexts: { light: [] }, default: 'dark' } } }),
        ),
      /Default context "dark" is not one of this modifier's contexts \(light\)/,
      '#default',
    );
  });

  it('rejects malformed sources', () => {
    expectParseError(
      () => parseResolverDocument(resolverWith({ sets: { base: { sources: 'base.json' } } })),
      /Expected an array of sources, got a string at "sets\.base\.sources"/,
      '#sets',
    );
    expectParseError(
      () => parseResolverDocument(resolverWith({ sets: { base: { sources: [{ $ref: 42 }] } } })),
      /"\$ref" must be a non-empty string/,
      'reference-objects',
    );
  });
});

describe('buildTokenGraphFromResolver', () => {
  const resolver = parseResolverDocument(RESOLVER);

  it('applies the default context when no input is given', () => {
    const { graph, contexts, sources } = buildTokenGraphFromResolver({
      resolver,
      resolverSource: 'ds.resolver.json',
      files: tokenFiles(),
    });

    expect(contexts).toEqual({ theme: 'light' });
    expect(sources).toEqual(['base.json', 'themes/light.json', 'components.json']);
    expect(graph.nodes.map((node) => node.path.join('.'))).toEqual([
      'color.blue-500',
      'color.gray-100',
      'color.gray-900',
      'semantic.accent',
      'semantic.bg',
      'semantic.fg',
      'button.background',
      'button.text',
    ]);
    expect(graph.getOutgoingEdges(['semantic', 'bg'])[0].to).toEqual(['color', 'gray-100']);
    expect(graph.getOutgoingEdges(['button', 'background'])[0].to).toEqual(['semantic', 'bg']);
  });

  it('follows the selected context and lets it override earlier tokens', () => {
    const { graph, contexts } = buildTokenGraphFromResolver({
      resolver,
      resolverSource: 'ds.resolver.json',
      files: tokenFiles(),
      input: { theme: 'dark' },
    });

    expect(contexts).toEqual({ theme: 'dark' });
    expect(graph.getOutgoingEdges(['semantic', 'bg'])[0].to).toEqual(['color', 'gray-900']);
    // `semantic.accent` is defined in base.json and overridden by dark.json — last wins, no collision error.
    const accent = graph.getNode(['semantic', 'accent']);
    expect(accent?.source).toBe('themes/dark.json');
    expect(accent?.value).toBe('{color.gray-100}');
    expect(graph.nodes.filter((node) => node.path.join('.') === 'semantic.accent')).toHaveLength(1);
  });

  it('resolves $ref file paths relative to the resolver when sources carry directories', () => {
    const files = fixtureFiles().map((file) => ({ ...file, source: `tokens/${file.source}` }));
    const { graph } = buildTokenGraphFromResolver({
      resolver,
      resolverSource: 'tokens/ds.resolver.json',
      files: files.filter((file) => !file.source.endsWith('ds.resolver.json')),
      input: { theme: 'dark' },
    });
    expect(graph.getNode(['semantic', 'bg'])?.source).toBe('tokens/themes/dark.json');
  });

  it('falls back to matching $ref file names when only names are known (browser uploads)', () => {
    const files = fixtureFilesByName().filter((file) => file.source !== 'ds.resolver.json');
    const { graph } = buildTokenGraphFromResolver({
      resolver,
      resolverSource: 'ds.resolver.json',
      files,
    });
    expect(graph.getNode(['semantic', 'bg'])?.source).toBe('light.json');
  });

  it('rejects a $ref that matches no file, or several files by name', () => {
    expectParseError(
      () =>
        buildTokenGraphFromResolver({
          resolver,
          files: tokenFiles().filter((file) => !file.source.includes('light')),
        }),
      /"\$ref": "themes\/light.json" does not match any provided file \(provided: "base.json", "themes\/dark.json", "components.json"\)/,
      'reference-objects',
    );
    // No exact or resolver-relative match, and two candidates share the referenced file name.
    const ambiguous = tokenFiles().flatMap((file) =>
      file.source === 'themes/light.json'
        ? [
            { ...file, source: 'a/light.json' },
            { ...file, source: 'b/light.json' },
          ]
        : [file],
    );
    expectParseError(
      () => buildTokenGraphFromResolver({ resolver, files: ambiguous }),
      /"\$ref": "themes\/light.json" is ambiguous — it matches several files by name: "a\/light.json", "b\/light.json"/,
      'reference-objects',
    );
  });

  it('rejects inputs naming an unknown modifier or context', () => {
    expectParseError(
      () =>
        buildTokenGraphFromResolver({
          resolver,
          files: tokenFiles(),
          input: { density: 'compact' },
        }),
      /Unknown modifier "density" in input — declared modifiers: theme/,
      '#inputs',
    );
    expectParseError(
      () =>
        buildTokenGraphFromResolver({ resolver, files: tokenFiles(), input: { theme: 'sepia' } }),
      /Unknown context "sepia" for modifier "theme" — available contexts: light, dark/,
      '#inputs',
    );
  });

  it('rejects a modifier left without a context when it has no default', () => {
    const noDefault = parseResolverDocument(
      resolverWith({
        modifiers: {
          theme: {
            contexts: (RESOLVER as { modifiers: { theme: { contexts: unknown } } }).modifiers.theme
              .contexts,
          },
        },
      }),
    );
    expectParseError(
      () => buildTokenGraphFromResolver({ resolver: noDefault, files: tokenFiles() }),
      /Modifier "theme" has no default context and none was given — choose one of: light, dark/,
      '#inputs',
    );
    expect(
      buildTokenGraphFromResolver({
        resolver: noDefault,
        files: tokenFiles(),
        input: { theme: 'dark' },
      }).contexts,
    ).toEqual({ theme: 'dark' });
  });

  it('accepts inline token sources, set-to-set references, and $ref overrides', () => {
    const inline = parseResolverDocument({
      version: '2025.10',
      sets: {
        palette: {
          sources: [{ color: { $type: 'color', a: { $value: '#000' }, b: { $value: '#fff' } } }],
        },
        everything: {
          sources: [
            { $ref: '#/sets/palette' },
            { $ref: 'components.json', button: { text: { $type: 'color', $value: '{color.b}' } } },
          ],
        },
      },
      modifiers: {
        theme: {
          default: 'light',
          contexts: {
            light: [
              {
                semantic: {
                  $type: 'color',
                  bg: { $value: '{color.a}' },
                  fg: { $value: '{color.b}' },
                },
              },
            ],
          },
        },
      },
      resolutionOrder: [{ $ref: '#/modifiers/theme' }, { $ref: '#/sets/everything' }],
    });
    const { graph, sources } = buildTokenGraphFromResolver({
      resolver: inline,
      resolverSource: 'x.resolver.json',
      files: tokenFiles(),
    });

    expect(sources).toEqual([
      'x.resolver.json#/modifiers/theme/contexts/light/0',
      'x.resolver.json#/sets/palette/sources/0',
      'components.json',
      'x.resolver.json#/sets/everything/sources/1',
    ]);
    expect(graph.getNode(['button', 'text'])?.source).toBe(
      'x.resolver.json#/sets/everything/sources/1',
    );
    expect(graph.getOutgoingEdges(['button', 'text'])[0].to).toEqual(['color', 'b']);
    expect(graph.getNode(['button', 'background'])?.source).toBe('components.json');
  });

  it('selects a sub-tree of a referenced file through a JSON pointer suffix', () => {
    const pointer = parseResolverDocument({
      version: '2025.10',
      sets: { colors: { sources: [{ $ref: 'base.json#/color' }] } },
      resolutionOrder: [{ $ref: '#/sets/colors' }],
    });
    const { graph, sources } = buildTokenGraphFromResolver({
      resolver: pointer,
      files: tokenFiles(),
    });

    expect(sources).toEqual(['base.json#/color']);
    expect(graph.nodes.map((node) => node.path.join('.'))).toEqual([
      'blue-500',
      'gray-100',
      'gray-900',
    ]);
    expectParseError(
      () =>
        buildTokenGraphFromResolver({
          resolver: parseResolverDocument({
            version: '2025.10',
            sets: { x: { sources: [{ $ref: 'base.json#/nope/deeper' }] } },
            resolutionOrder: [{ $ref: '#/sets/x' }],
          }),
          files: tokenFiles(),
        }),
      /"\$ref": "base.json#\/nope\/deeper" points at nothing — "nope" was not found/,
      'invalid-pointers',
    );
  });

  it('rejects circular set references and sources that reference a modifier', () => {
    const cyclic = parseResolverDocument({
      version: '2025.10',
      sets: { a: { sources: [{ $ref: '#/sets/b' }] }, b: { sources: [{ $ref: '#/sets/a' }] } },
      resolutionOrder: [{ $ref: '#/sets/a' }],
    });
    expectParseError(
      () => buildTokenGraphFromResolver({ resolver: cyclic, files: [] }),
      /Circular set reference: #\/sets\/a → #\/sets\/b → #\/sets\/a/,
      'invalid-pointers',
    );

    const modifierRef = parseResolverDocument({
      version: '2025.10',
      sets: { a: { sources: [{ $ref: '#/modifiers/theme' }] } },
      modifiers: { theme: { default: 'light', contexts: { light: [] } } },
      resolutionOrder: [{ $ref: '#/sets/a' }],
    });
    expectParseError(
      () => buildTokenGraphFromResolver({ resolver: modifierRef, files: [] }),
      /never modifiers/,
      'invalid-pointers',
    );
  });

  it('still rejects alias cycles and dangling aliases after the merge', () => {
    const broken = parseResolverDocument({
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'components.json' }] } },
      resolutionOrder: [{ $ref: '#/sets/base' }],
    });
    expectParseError(
      () => buildTokenGraphFromResolver({ resolver: broken, files: tokenFiles() }),
      /Alias "\{semantic\.bg\}" does not resolve to any known token/,
      'aliases-references',
    );
  });
});

describe('buildTokenGraphFromDocuments', () => {
  it('detects the resolver among the files and reports what it applied', () => {
    const build = buildTokenGraphFromDocuments(fixtureFilesByName(), { input: { theme: 'dark' } });

    expect(build.resolver?.source).toBe('ds.resolver.json');
    expect(build.resolver?.contexts).toEqual({ theme: 'dark' });
    expect(build.resolver?.sources).toEqual(['base.json', 'dark.json', 'components.json']);
    expect(build.graph.getOutgoingEdges(['semantic', 'bg'])[0].to).toEqual(['color', 'gray-900']);
  });

  it('keeps the strict cross-file merge when no resolver is present', () => {
    const files = fixtureFilesByName().filter((file) => file.source !== 'ds.resolver.json');
    expectParseError(
      () => buildTokenGraphFromDocuments(files),
      /Token "semantic\.bg" is defined in both "light\.json" and "dark\.json"/,
      '#groups',
    );

    const oneTheme = files.filter((file) => file.source !== 'dark.json');
    const build = buildTokenGraphFromDocuments(oneTheme);
    expect(build.resolver).toBeUndefined();
    expect(build.graph.nodes).toHaveLength(8);
  });

  it('rejects contexts given without a resolver, and more than one resolver', () => {
    const files = fixtureFilesByName().filter((file) => file.source !== 'ds.resolver.json');
    expectParseError(
      () => buildTokenGraphFromDocuments(files, { input: { theme: 'dark' } }),
      /Contexts were given \(theme=dark\) but none of the files is a resolver document/,
      '#inputs',
    );
    expectParseError(
      () =>
        buildTokenGraphFromDocuments([
          ...fixtureFilesByName(),
          { source: 'other.resolver.json', document: RESOLVER },
        ]),
      /Expected at most one resolver document, got 2: "ds\.resolver\.json", "other\.resolver\.json"/,
      'root-level-properties',
    );
  });
});
