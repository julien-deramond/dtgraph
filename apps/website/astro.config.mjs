import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { CSP_HEADER_VALUE } from './src/lib/csp.js';

export default defineConfig({
  site: 'https://dtgraph.dev',
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
