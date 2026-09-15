/**
 * Baseline Content-Security-Policy for the whole site, applied via a <meta> tag on every page
 * (both the playground layout and Starlight's docs layout, via astro.config.mjs's `head`).
 * `frame-ancestors` and other header-only directives can't be expressed via <meta> — add them
 * as response headers once #27 picks a deployment host.
 */
export const CSP_HEADER_VALUE =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  // Starlight's Pagefind search loads its worker script same-origin, then constructs it as a
  // `blob:` URL — `worker-src 'self'` alone isn't enough, `blob:` must be explicit too.
  "worker-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';";
