import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { CSP_HEADER_VALUE } from './src/lib/csp.js';

export default defineConfig({
  // Deployed to GitHub Pages as a project site (github.com/julien-deramond/dtgraph) rather than
  // a github.io user/org root, so it's served under a /dtgraph/ path — see #27 and
  // apps/website/README.md. Swap to a custom domain's root URL (and drop `base`) if one is
  // ever configured via a CNAME.
  site: 'https://julien-deramond.github.io',
  base: '/dtgraph',
  integrations: [
    starlight({
      title: 'dtgraph',
      description: 'Render and validate Design Tokens Community Group (DTCG) token graphs.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/julien-deramond/dtgraph' },
      ],
      // Docs content lives under src/content/docs/docs/* so its routes land at /docs/*,
      // leaving the site root ("/") free for the playground page in src/pages/index.astro.
      sidebar: [
        {
          label: 'Docs',
          items: [{ autogenerate: { directory: 'docs' } }],
        },
      ],
      // Starlight renders its own layout, not SiteLayout.astro, so the same baseline CSP
      // (see src/lib/csp.ts) is injected here to cover the /docs/* pages too.
      head: [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_HEADER_VALUE },
        },
      ],
    }),
  ],
});
