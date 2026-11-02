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

describe('dtgraph render --format mermaid (end-to-end)', () => {
  async function writeTokens(): Promise<string> {
    const inputFile = join(dir, 'tokens.json');
    await writeFile(
      inputFile,
      JSON.stringify({
        color: {
          brand: { $type: 'color', $value: '#112233' },
          accent: { $value: '{color.brand}' },
        },
      }),
    );
    return inputFile;
  }

  it('writes Mermaid text to the file given via -o', async () => {
    const inputFile = await writeTokens();
    const outputFile = join(dir, 'graph.mmd');

    await createProgram().parseAsync([
      'node',
      'dtgraph',
      'render',
      inputFile,
      '--format',
      'mermaid',
      '-o',
      outputFile,
    ]);

    const mermaid = await readFile(outputFile, 'utf8');
    expect(mermaid.startsWith('flowchart LR\n')).toBe(true);
    expect(mermaid).toMatch(/t_color_accent_\w+ --> t_color_brand_\w+/);
  });

  it('writes a fenced block with full paths to stdout', async () => {
    const inputFile = await writeTokens();

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await createProgram().parseAsync([
        'node',
        'dtgraph',
        'render',
        inputFile,
        '--format',
        'mermaid',
        '--fence',
        '--full-paths',
      ]);
      const written = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(written.startsWith('```mermaid\nflowchart LR\n')).toBe(true);
      expect(written.endsWith('\n```\n')).toBe(true);
      expect(written).toContain('["color.brand"]');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('rejects the Mermaid-only flags with the default SVG format', async () => {
    const inputFile = await writeTokens();

    await expect(
      createProgram().parseAsync(['node', 'dtgraph', 'render', inputFile, '--fence']),
    ).rejects.toThrow('--fence only applies with --format mermaid');
    await expect(
      createProgram().parseAsync([
        'node',
        'dtgraph',
        'render',
        inputFile,
        '--fence',
        '--full-paths',
      ]),
    ).rejects.toThrow('--fence and --full-paths only apply with --format mermaid');
  });

  it('rejects an unknown format', async () => {
    const inputFile = await writeTokens();
    const program = createProgram().exitOverride();
    for (const command of program.commands) {
      command.exitOverride().configureOutput({ writeErr: () => undefined });
    }

    await expect(
      program.parseAsync(['node', 'dtgraph', 'render', inputFile, '--format', 'dot']),
    ).rejects.toThrow(/Allowed choices are svg, mermaid/);
  });
});

describe('dtgraph validate (end-to-end)', () => {
  it('prints a human-readable summary and exits 0 for valid file(s)', async () => {
    const inputFile = join(dir, 'tokens.json');
    await writeFile(
      inputFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      await createProgram().parseAsync(['node', 'dtgraph', 'validate', inputFile]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 file(s) valid'));
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it('prints a JSON result and sets a non-zero exit code for an invalid file', async () => {
    const inputFile = join(dir, 'tokens.json');
    await writeFile(
      inputFile,
      JSON.stringify({ color: { accent: { $value: '{color.nonexistent}' } } }),
    );

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      await createProgram().parseAsync(['node', 'dtgraph', 'validate', '--json', inputFile]);
      const written = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      const result = JSON.parse(written) as { ok: boolean; error?: { message: string } };
      expect(result.ok).toBe(false);
      expect(result.error?.message).toMatch(/does not resolve to any known token/);
      expect(process.exitCode).toBe(1);
    } finally {
      writeSpy.mockRestore();
      process.exitCode = originalExitCode;
    }
  });
});
