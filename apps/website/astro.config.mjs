import { readFileSync } from 'node:fs';

import mdx from '@astrojs/mdx';
import deramond from '@deramond.dev/astro/integration';
import { defineConfig } from 'astro/config';

// The version pill in the docs top bar follows the published CLI, which changesets bumps.
const { version } = JSON.parse(
  readFileSync(new URL('../../packages/cli/package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  // Deployed to GitHub Pages as a project site (github.com/julien-deramond/dtgraph) rather than
  // a github.io user/org root, so it's served under a /dtgraph/ path — see #27 and
  // apps/website/README.md. Swap to a custom domain's root URL (and drop `base`) if one is
  // ever configured via a CNAME.
  site: 'https://julien-deramond.github.io',
  base: '/dtgraph',
  integrations: [
    mdx(),
    deramond({
      site: {
        name: 'dtgraph',
        description: 'Render and validate Design Tokens Community Group (DTCG) token graphs.',
      },
      brand: { mark: './src/brand/mark.svg', favicons: './src/brand/favicons/' },
      og: { art: './src/brand/og-art.png' },
      docs: {
        tool: { version: `v${version}` },
        tabs: [
          { label: 'Playground', href: '/dtgraph/' },
          { label: 'Docs', href: '/dtgraph/docs/' },
        ],
        edit: { repo: 'julien-deramond/dtgraph', dir: 'apps/website' },
      },
    }),
  ],
  vite: {
    build: {
      // Never inline a small bundled <script> into the HTML: the playground's CSP
      // (src/lib/csp.ts) is `script-src 'self'` with no hashes, so an inlined module would
      // simply be blocked.
      assetsInlineLimit: 0,
    },
  },
});
