/**
 * Content-Security-Policy for the playground, the one page that takes untrusted input, applied
 * via a <meta> tag by src/pages/index.astro. Every script on the page is an Astro-bundled
 * external module, so `script-src 'self'` holds with no hashes or nonces; `'wasm-unsafe-eval'`
 * only lets the docs search (Pagefind) compile its WebAssembly. `style-src` needs
 * `'unsafe-inline'` for `style=""` attributes and the viewer's runtime-injected stylesheet.
 * `frame-ancestors` and other header-only directives can't be expressed via <meta> — add them
 * as response headers if the site ever moves off GitHub Pages.
 */
export const CSP_HEADER_VALUE =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';";
