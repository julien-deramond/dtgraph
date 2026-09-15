import { describe, expect, it } from 'vitest';

import { docsHref, docsNeighbors, docsPages, docsSlug } from '../src/lib/docs.js';
import type { DocsEntryLike } from '../src/lib/docs.js';

const entry = (id: string, data: Partial<DocsEntryLike['data']> = {}): DocsEntryLike => ({
  id,
  data: { title: id, description: `About ${id}`, ...data },
});

describe('docsSlug', () => {
  it('maps the index file to the docs root and anything else to its id', () => {
    expect(docsSlug('index')).toBeUndefined();
    expect(docsSlug('getting-started')).toBe('getting-started');
    expect(docsSlug('guides/index')).toBe('guides');
    expect(docsSlug('guides/themes')).toBe('guides/themes');
  });
});

describe('docsHref', () => {
  it('builds base-prefixed, trailing-slash URLs', () => {
    expect(docsHref('/dtgraph', 'index')).toBe('/dtgraph/docs/');
    expect(docsHref('/dtgraph/', 'cli-reference')).toBe('/dtgraph/docs/cli-reference/');
    expect(docsHref('/', 'guides/themes')).toBe('/docs/guides/themes/');
  });
});

describe('docsPages', () => {
  it('sorts by order, then title for entries without one', () => {
    const pages = docsPages('/dtgraph', [
      entry('zeta'),
      entry('cli-reference', { order: 3 }),
      entry('alpha'),
      entry('index', { order: 0, label: 'Overview' }),
      entry('getting-started', { order: 1 }),
    ]);
    expect(pages.map((page) => page.id)).toEqual([
      'index',
      'getting-started',
      'cli-reference',
      'alpha',
      'zeta',
    ]);
  });

  it('exposes the sidebar label, path and href of each page', () => {
    const [overview, cli] = docsPages('/dtgraph', [
      entry('index', { order: 0, label: 'Overview', title: 'dtgraph docs' }),
      entry('cli-reference', { order: 1, title: 'CLI reference' }),
    ]);
    expect(overview).toEqual({
      id: 'index',
      title: 'dtgraph docs',
      description: 'About index',
      label: 'Overview',
      path: '',
      href: '/dtgraph/docs/',
    });
    expect(cli.label).toBe('CLI reference');
    expect(cli.path).toBe('cli-reference/');
    expect(cli.href).toBe('/dtgraph/docs/cli-reference/');
  });
});

describe('docsNeighbors', () => {
  const pages = docsPages('/', [
    entry('index', { order: 0 }),
    entry('getting-started', { order: 1 }),
    entry('cli-reference', { order: 2 }),
  ]);

  it('returns the pages around the given one in sidebar order', () => {
    const { previous, next } = docsNeighbors(pages, 'getting-started');
    expect(previous?.id).toBe('index');
    expect(next?.id).toBe('cli-reference');
  });

  it('leaves out the missing side at either end', () => {
    expect(docsNeighbors(pages, 'index').previous).toBeUndefined();
    expect(docsNeighbors(pages, 'cli-reference').next).toBeUndefined();
  });

  it('returns nothing for an unknown page', () => {
    expect(docsNeighbors(pages, 'nope')).toEqual({});
  });
});
