import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatValidateSummary, validateTokenFiles } from '../src/commands/validate.js';
import { renderTokenFilesToSvg } from '../src/commands/render.js';
import { createProgram } from '../src/program.js';
import { parseContextOptions } from '../src/token-graph.js';

const RESOLVER = {
  version: '2025.10',
  sets: {
    base: { sources: [{ $ref: 'base.json' }] },
    components: { sources: [{ $ref: 'components.json' }] },
  },
  modifiers: {
    theme: {
      default: 'light',
      contexts: { light: [{ $ref: 'themes/light.json' }], dark: [{ $ref: 'themes/dark.json' }] },
    },
  },
  resolutionOrder: [
    { $ref: '#/sets/base' },
    { $ref: '#/modifiers/theme' },
    { $ref: '#/sets/components' },
  ],
};
const BASE = {
  color: { $type: 'color', 'gray-100': { $value: '#f3f4f6' }, 'gray-900': { $value: '#111827' } },
};
const LIGHT = { semantic: { $type: 'color', bg: { $value: '{color.gray-100}' } } };
const DARK = { semantic: { $type: 'color', bg: { $value: '{color.gray-900}' } } };
const COMPONENTS = { button: { $type: 'color', background: { $value: '{semantic.bg}' } } };

const FILES = [
  { source: 'ds.resolver.json', content: JSON.stringify(RESOLVER) },
  { source: 'base.json', content: JSON.stringify(BASE) },
  { source: 'themes/light.json', content: JSON.stringify(LIGHT) },
  { source: 'themes/dark.json', content: JSON.stringify(DARK) },
  { source: 'components.json', content: JSON.stringify(COMPONENTS) },
];

describe('parseContextOptions', () => {
  it('turns repeated and comma-separated modifier=context pairs into an input map', () => {
    expect(parseContextOptions([])).toEqual({});
    expect(parseContextOptions(['theme=dark'])).toEqual({ theme: 'dark' });
    expect(parseContextOptions(['theme=dark', 'density=compact'])).toEqual({
      theme: 'dark',
      density: 'compact',
    });
    expect(parseContextOptions(['theme=dark, density=compact'])).toEqual({
      theme: 'dark',
      density: 'compact',
    });
  });

  it('rejects a value without a modifier or a context', () => {
    expect(() => parseContextOptions(['dark'])).toThrow(/Invalid --context value "dark"/);
    expect(() => parseContextOptions(['theme='])).toThrow(/expected <modifier>=<context>/);
    expect(() => parseContextOptions(['=dark'])).toThrow(/expected <modifier>=<context>/);
  });
});

describe('validateTokenFiles with a resolver', () => {
  it('applies the default context and reports the resolver in the result', () => {
    const result = validateTokenFiles(FILES);

    expect(result).toEqual({
      ok: true,
      files: FILES.map((file) => file.source),
      tokenCount: 4,
      edgeCount: 2,
      resolver: { source: 'ds.resolver.json', contexts: { theme: 'light' } },
    });
    expect(formatValidateSummary(result)).toBe(
      '✓ 5 file(s) valid — 4 token(s), 2 edge(s) · resolver ds.resolver.json · theme=light',
    );
  });

  it('applies the requested context', () => {
    const result = validateTokenFiles(FILES, { context: { theme: 'dark' } });
    expect(result.ok).toBe(true);
    expect(result.resolver?.contexts).toEqual({ theme: 'dark' });
  });

  it('reports an unknown context as a structured, non-ok result', () => {
    const result = validateTokenFiles(FILES, { context: { theme: 'sepia' } });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/Unknown context "sepia" for modifier "theme"/);
    expect(result.error?.specReference).toContain('resolver/#inputs');
  });

  it('reports a context given without a resolver as non-ok', () => {
    const result = validateTokenFiles(FILES.slice(1), { context: { theme: 'dark' } });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/none of the files is a resolver document/);
  });

  it('leaves plain multi-file validation unchanged (no resolver key)', () => {
    const result = validateTokenFiles([FILES[1], FILES[2], FILES[4]]);
    expect(result).toEqual({
      ok: true,
      files: ['base.json', 'themes/light.json', 'components.json'],
      tokenCount: 4,
      edgeCount: 2,
    });
    expect(formatValidateSummary(result)).toBe('✓ 3 file(s) valid — 4 token(s), 2 edge(s)');
  });
});

describe('renderTokenFilesToSvg with a resolver', () => {
  it('renders the graph of the selected context', () => {
    const svg = renderTokenFilesToSvg(FILES, { context: { theme: 'dark' } });
    expect(svg).toContain('<svg');
    expect(svg).toContain('button.background');
    expect(svg).toContain('semantic.bg');
  });
});

describe('dtgraph CLI with a resolver on disk (end-to-end)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dtgraph-cli-resolver-'));
    await mkdir(join(dir, 'themes'));
    for (const file of FILES) {
      await writeFile(join(dir, file.source), file.content);
    }
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const paths = (): string[] => FILES.map((file) => join(dir, file.source));

  it('validate --json reports the resolver and the contexts applied via --context', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await createProgram().parseAsync([
        'node',
        'dtgraph',
        'validate',
        ...paths(),
        '--json',
        '--context',
        'theme=dark',
      ]);
      const output = JSON.parse(writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('')) as {
        ok: boolean;
        resolver?: { source: string; contexts: Record<string, string> };
      };
      expect(output.ok).toBe(true);
      expect(output.resolver).toEqual({
        source: join(dir, 'ds.resolver.json'),
        contexts: { theme: 'dark' },
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      writeSpy.mockRestore();
      process.exitCode = undefined;
    }
  });

  it('validate exits 1 on a malformed --context value without crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await createProgram().parseAsync([
        'node',
        'dtgraph',
        'validate',
        ...paths(),
        '--context',
        'dark',
      ]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Invalid --context value "dark"/),
      );
      expect(process.exitCode).toBe(1);
    } finally {
      errorSpy.mockRestore();
      process.exitCode = undefined;
    }
  });

  it('render -c writes the SVG for the requested context', async () => {
    const outputFile = join(dir, 'graph.svg');
    await createProgram().parseAsync([
      'node',
      'dtgraph',
      'render',
      ...paths(),
      '-c',
      'theme=dark',
      '-o',
      outputFile,
    ]);
    const svg = await readFile(outputFile, 'utf8');
    expect(svg).toContain('button.background');
  });
});
