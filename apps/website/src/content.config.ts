import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

/**
 * The docs: one Markdown/MDX file per page under src/content/docs, rendered by
 * src/pages/docs/[...slug].astro. `index.md` is the docs root (/docs/); any other file lands
 * at /docs/<its path without extension>/. Sidebar order and label come from frontmatter
 * (see src/lib/docs.ts).
 */
export const collections = {
  docs: defineCollection({
    loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      order: z.number().int().nonnegative().optional(),
      label: z.string().optional(),
    }),
  }),
};
