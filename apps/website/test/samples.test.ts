import { describe, expect, it } from 'vitest';

import { buildTokenGraphFromFiles } from '../src/lib/playground.js';
import { SAMPLES, THIS_SITE } from '../src/samples/index.js';

describe('samples', () => {
  it.each(SAMPLES.map((sample) => [sample.id, sample] as const))(
    '%s builds a graph with no error',
    (_, sample) => {
      const { graph } = buildTokenGraphFromFiles(sample.files);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    },
  );

  it("uses every file of this site's tokens through the resolver", () => {
    const { resolver } = buildTokenGraphFromFiles(THIS_SITE.files);
    expect(resolver?.source).toBe('brand.resolver.json');
    const used = new Set(resolver?.sources.map((source) => source.replace(/#.*$/, '')));
    expect(THIS_SITE.files.slice(1).every(({ source }) => used.has(source))).toBe(true);
  });
});
