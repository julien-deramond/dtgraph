/**
 * URL helpers for a site served under a base path. The website is a GitHub Pages project site
 * (see astro.config.mjs and README.md), so every internal link has to be prefixed with
 * `import.meta.env.BASE_URL` — whose trailing slash Astro leaves up to configuration. These
 * helpers make that prefix a detail no template has to think about.
 */

/** Join `base` and a site-relative `path` with exactly one slash between them. */
export function withBase(base: string, path = ''): string {
  const root = base.replace(/\/+$/, '');
  const rest = path.replace(/^\/+/, '');
  return `${root}/${rest}`;
}

/** `pathname` without the site's base prefix, always starting with a slash. */
export function stripBase(base: string, pathname: string): string {
  const root = base.replace(/\/+$/, '');
  const stripped =
    root !== '' && pathname.startsWith(root) ? pathname.slice(root.length) : pathname;
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/** Which top-level surface a pathname belongs to, for the header's current-page marker. */
export function siteSection(base: string, pathname: string): 'playground' | 'docs' | undefined {
  const path = stripBase(base, pathname);
  if (path === '/docs' || path.startsWith('/docs/')) return 'docs';
  if (path === '/' || path === '/index.html') return 'playground';
  return undefined;
}
