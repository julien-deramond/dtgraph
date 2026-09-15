/**
 * Baseline Content-Security-Policy for the whole site, applied via a <meta> tag on every page
 * by src/layouts/SiteLayout.astro (the docs and the playground share that layout). Every
 * script on the site is an Astro-bundled external module, so `script-src 'self'` holds with
 * no hashes or nonces; `style-src` needs `'unsafe-inline'` for `style=""` attributes (e.g.
 * `<TokenGraph height>`) and the viewer's runtime-injected stylesheet.
 * `frame-ancestors` and other header-only directives can't be expressed via <meta> — add them
 * as response headers if the site ever moves off GitHub Pages.
 */
export const CSP_HEADER_VALUE =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';";
