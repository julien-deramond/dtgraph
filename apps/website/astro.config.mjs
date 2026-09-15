import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Deployed to GitHub Pages as a project site (github.com/julien-deramond/dtgraph) rather than
  // a github.io user/org root, so it's served under a /dtgraph/ path — see #27 and
  // apps/website/README.md. Swap to a custom domain's root URL (and drop `base`) if one is
  // ever configured via a CNAME.
  site: 'https://julien-deramond.github.io',
  base: '/dtgraph',
  integrations: [mdx()],
  vite: {
    build: {
      // Never inline a small bundled <script> into the HTML: the site's CSP (src/lib/csp.ts)
      // is `script-src 'self'` with no hashes, so an inlined module would simply be blocked.
      assetsInlineLimit: 0,
    },
  },
  markdown: {
    shikiConfig: {
      // Both themes ship in every code block as CSS custom properties; src/styles/global.css
      // picks one per the site's color-scheme, so fences follow the theme toggle live.
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
