import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/program.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dtgraph-cli-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('dtgraph render (end-to-end)', () => {
  it('writes SVG to the file given via -o', async () => {
    const inputFile = join(dir, 'tokens.json');
    const outputFile = join(dir, 'graph.svg');
    await writeFile(
      inputFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
    );

    await createProgram().parseAsync(['node', 'dtgraph', 'render', inputFile, '-o', outputFile]);

    const svg = await readFile(outputFile, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('color.brand');
  });

  it('writes SVG to stdout when no -o is given', async () => {
    const inputFile = join(dir, 'tokens.json');
    await writeFile(
      inputFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
    );

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await createProgram().parseAsync(['node', 'dtgraph', 'render', inputFile]);
      const written = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(written).toContain('<svg');
      expect(written).toContain('color.brand');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('rejects with the core error when a file has a dangling alias', async () => {
    const inputFile = join(dir, 'tokens.json');
    await writeFile(
      inputFile,
      JSON.stringify({ color: { accent: { $value: '{color.nonexistent}' } } }),
    );

    await expect(
      createProgram().parseAsync(['node', 'dtgraph', 'render', inputFile]),
    ).rejects.toThrow(/does not resolve to any known token/);
  });
});
