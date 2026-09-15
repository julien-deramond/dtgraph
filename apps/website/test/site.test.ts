import { describe, expect, it } from 'vitest';

import { siteSection, stripBase, withBase } from '../src/lib/site.js';

describe('withBase', () => {
  it('joins a base and a path with exactly one slash, whatever they carry', () => {
    expect(withBase('/dtgraph', 'docs/')).toBe('/dtgraph/docs/');
    expect(withBase('/dtgraph/', 'docs/')).toBe('/dtgraph/docs/');
    expect(withBase('/dtgraph', '/docs/')).toBe('/dtgraph/docs/');
  });

  it('yields the site root for an empty path', () => {
    expect(withBase('/dtgraph')).toBe('/dtgraph/');
    expect(withBase('/dtgraph/')).toBe('/dtgraph/');
  });

  it('works when the site is served at the domain root', () => {
    expect(withBase('/', 'docs/')).toBe('/docs/');
    expect(withBase('/')).toBe('/');
  });
});

describe('stripBase', () => {
  it('removes the base prefix and keeps a leading slash', () => {
    expect(stripBase('/dtgraph', '/dtgraph/docs/viewer/')).toBe('/docs/viewer/');
    expect(stripBase('/dtgraph/', '/dtgraph')).toBe('/');
    expect(stripBase('/', '/docs/')).toBe('/docs/');
  });
});

describe('siteSection', () => {
  it('tells the playground and the docs apart, with or without a base', () => {
    expect(siteSection('/dtgraph', '/dtgraph/')).toBe('playground');
    expect(siteSection('/dtgraph', '/dtgraph')).toBe('playground');
    expect(siteSection('/dtgraph', '/dtgraph/docs/')).toBe('docs');
    expect(siteSection('/dtgraph', '/dtgraph/docs/cli-reference/')).toBe('docs');
    expect(siteSection('/', '/docs')).toBe('docs');
  });

  it('is undefined for anything else, such as the 404 page', () => {
    expect(siteSection('/dtgraph', '/dtgraph/404')).toBeUndefined();
    expect(siteSection('/dtgraph', '/dtgraph/docsy/')).toBeUndefined();
  });
});
