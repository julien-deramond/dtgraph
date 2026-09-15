import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import TokenGraph from '../src/TokenGraph.astro';

describe('TokenGraph.astro', () => {
  it('renders a token graph from inline tokens', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TokenGraph, {
      props: {
        tokens: {
          color: {
            brand: { $type: 'color', $value: '#112233' },
            accent: { $value: '{color.brand}' },
          },
        },
      },
    });

    expect(html).toContain('<svg');
    expect(html).toContain('color.brand');
    expect(html).toContain('color.accent');
  });

  describe('interactive mode', () => {
    it('ships the resolved graph as a non-executable JSON payload instead of the SVG', async () => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(TokenGraph, {
        props: {
          interactive: true,
          height: '300px',
          theme: 'light',
          colorBy: 'type',
          tokens: {
            color: {
              brand: { $type: 'color', $value: '#112233' },
              accent: { $value: '{color.brand}' },
            },
          },
        },
      });

      expect(html).not.toContain('<svg');
      expect(html).toContain('data-dtgraph-interactive');
      expect(html).toContain('data-dtgraph-theme="light"');
      expect(html).toContain('data-dtgraph-color-by="type"');
      expect(html).toContain('data-dtgraph-chrome="true"');
      expect(html).toContain('height: 300px');
      expect(html).toContain('<script type="application/json" data-dtgraph-graph>');
      const payload = /data-dtgraph-graph>(.*?)<\/script>/s.exec(html)?.[1] ?? '';
      const parsed = JSON.parse(payload) as { nodes: unknown[]; edges: unknown[] };
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.edges).toHaveLength(1);
      expect(parsed.edges[0]).toMatchObject({ from: ['color', 'accent'], to: ['color', 'brand'] });
    });

    it('escapes token text so it can never close the payload element', async () => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(TokenGraph, {
        props: {
          interactive: true,
          tokens: {
            color: {
              brand: {
                $type: 'color',
                $value: '#112233',
                $description: '</script><script>alert(1)</script>',
              },
            },
          },
        },
      });

      expect(html).not.toContain('<script>alert(1)');
      expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)');
      const payload = /data-dtgraph-graph>(.*?)<\/script>/s.exec(html)?.[1] ?? '';
      const parsed = JSON.parse(payload) as { nodes: { description?: string }[] };
      expect(parsed.nodes[0].description).toBe('</script><script>alert(1)</script>');
    });
  });

  it('throws a clear error when neither tokens nor a file is given', async () => {
    const container = await AstroContainer.create();
    await expect(container.renderToString(TokenGraph, { props: {} })).rejects.toThrow(
      /requires a "tokens" prop/,
    );
  });

  it('propagates a core error (dangling alias) unmodified', async () => {
    const container = await AstroContainer.create();
    await expect(
      container.renderToString(TokenGraph, {
        props: { tokens: { color: { accent: { $value: '{color.nonexistent}' } } } },
      }),
    ).rejects.toThrow(/does not resolve to any known token/);
  });

  describe('with a file prop', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'dtgraph-mdx-test-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('reads and renders a single token file', async () => {
      const filePath = join(dir, 'tokens.json');
      await writeFile(
        filePath,
        JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
      );

      const container = await AstroContainer.create();
      const html = await container.renderToString(TokenGraph, { props: { file: filePath } });

      expect(html).toContain('color.brand');
    });

    it('resolves aliases across multiple file paths', async () => {
      const colorFile = join(dir, 'color.json');
      const aliasFile = join(dir, 'alias.json');
      await writeFile(
        colorFile,
        JSON.stringify({ color: { brand: { $type: 'color', $value: '#112233' } } }),
      );
      await writeFile(
        aliasFile,
        JSON.stringify({ color: { accent: { $value: '{color.brand}' } } }),
      );

      const container = await AstroContainer.create();
      const html = await container.renderToString(TokenGraph, {
        props: { files: [colorFile, aliasFile] },
      });

      expect(html).toContain('color.brand');
      expect(html).toContain('color.accent');
    });
  });
});
