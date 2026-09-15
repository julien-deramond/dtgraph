import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

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
    }),
  ],
});
