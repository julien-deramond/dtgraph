import { getViteConfig } from 'astro/config';

// Astro's own Vite plugin is required to compile .astro files (TokenGraph.astro) for tests —
// plain vitest can't parse Astro's frontmatter fences on its own. See Astro's testing guide.
export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Astro's Container API needs a real Node environment, not jsdom.
    environment: 'node',
  },
});
