/**
 * The docs collection's navigation model: ordering, URLs and previous/next links, derived from
 * each entry's id and frontmatter (see src/content.config.ts). Kept free of `astro:content`
 * imports so it can be unit-tested outside Astro.
 */

import { withBase } from './site.js';

/** The slice of a collection entry this module needs. */
export interface DocsEntryLike {
  /** The glob loader's id: the file path under src/content/docs without its extension. */
  id: string;
  data: {
    title: string;
    description: string;
    /** Position in the sidebar; entries without one sort last, alphabetically by title. */
    order?: number;
    /** Sidebar text when it should differ from the page title. */
    label?: string;
  };
}

export interface DocsPage {
  id: string;
  title: string;
  description: string;
  /** Sidebar text. */
  label: string;
  /** Site-relative path under /docs/, with a trailing slash; empty for the docs root. */
  path: string;
  /** Absolute URL path including the site base. */
  href: string;
}

/** The `[...slug]` route param for an entry: `undefined` for the docs root (index.md). */
export function docsSlug(id: string): string | undefined {
  const slug = id.replace(/(^|\/)index$/, '');
  return slug === '' ? undefined : slug;
}

/** The URL path for an entry, e.g. `/dtgraph/docs/getting-started/`. */
export function docsHref(base: string, id: string): string {
  const slug = docsSlug(id);
  return withBase(base, slug === undefined ? 'docs/' : `docs/${slug}/`);
}

/** All entries as pages, in sidebar order. */
export function docsPages(base: string, entries: readonly DocsEntryLike[]): DocsPage[] {
  return [...entries]
    .sort((a, b) => {
      const orderA = a.data.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.data.order ?? Number.MAX_SAFE_INTEGER;
      return orderA !== orderB ? orderA - orderB : a.data.title.localeCompare(b.data.title);
    })
    .map((entry) => ({
      id: entry.id,
      title: entry.data.title,
      description: entry.data.description,
      label: entry.data.label ?? entry.data.title,
      path: docsSlug(entry.id) === undefined ? '' : `${docsSlug(entry.id)}/`,
      href: docsHref(base, entry.id),
    }));
}

/** The pages before and after `id` in sidebar order, for the previous/next footer links. */
export function docsNeighbors(
  pages: readonly DocsPage[],
  id: string,
): { previous?: DocsPage; next?: DocsPage } {
  const index = pages.findIndex((page) => page.id === id);
  if (index === -1) return {};
  return { previous: pages[index - 1], next: pages[index + 1] };
}
