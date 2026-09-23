import { docsLoader, docsSchema } from '@deramond.dev/astro/docs';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

/**
 * The docs: one Markdown/MDX file per page under src/content/docs, rendered by the docs route
 * `@deramond.dev/astro` adds. `index.md` is the docs root (/docs/); any other file lands at
 * /docs/<its path without extension>/. Sidebar order and label come from frontmatter (`order`,
 * `label`). Every page has a description, used as its lead and meta description.
 */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: z.object({ description: z.string() }) }),
  }),
};
