import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildTokenGraph } from '../src/graph.js';
import { flattenTokenTree, parseTokenTree } from '../src/parse.js';
import { resolveAliasEdges } from '../src/resolve.js';

const specFixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'spec');

function loadSpecFixture(file: string): unknown {
  const raw = readFileSync(join(specFixturesDir, file), 'utf8');
  return JSON.parse(raw);
}

/**
 * These fixtures are drawn from the DTCG format spec's own published examples (2025.10,
 * sections 8 "Types" and 9 "Composite types"), adapted only where a same-file, self-contained
 * fixture needs a referenced token the original spec excerpt left implicit. Running the full
 * parse -> resolve -> graph pipeline over them checks this package against real spec examples,
 * not just hand-rolled unit fixtures. A fixture that reveals a spec-compliance gap should be
 * filed as its own `upstream-drift` issue rather than patched inline here.
 */
describe('DTCG spec fixture suite', () => {
  it('parses every primitive $type example into a graph with no aliases', () => {
    const tree = parseTokenTree(loadSpecFixture('primitives.json'));
    const nodes = flattenTokenTree(tree);
    const edges = resolveAliasEdges(tree);
    const graph = buildTokenGraph(nodes, edges);

    // color, dimension x2, fontFamily x2, fontWeight x2, duration x2, cubicBezier x2, number
    expect(graph.nodes).toHaveLength(12);
    expect(graph.edges).toEqual([]);

    expect(graph.getNode(['font-weight', 'font-weight-thick'])?.value).toBe('extra-bold');
    expect(graph.getNode(['cubic-bezier', 'decelerate'])?.value).toEqual([0, 0, 0.5, 1]);
  });

  it('parses every composite $type example, resolving both cross-member and cross-type aliases', () => {
    const tree = parseTokenTree(loadSpecFixture('composites.json'));
    const nodes = flattenTokenTree(tree);
    const edges = resolveAliasEdges(tree);
    const graph = buildTokenGraph(nodes, edges);

    expect(graph.nodes).toHaveLength(20);

    // strokeStyle: an array-valued (dashArray) member alias.
    expect(graph.getOutgoingEdges(['stroke-style', 'notification-border-style'])).toEqual([
      {
        from: ['stroke-style', 'notification-border-style'],
        to: ['stroke-style', 'dash-length-medium'],
        reference: '{stroke-style.dash-length-medium}',
        kind: 'composite-member',
        member: 'dashArray[0]',
      },
      {
        from: ['stroke-style', 'notification-border-style'],
        to: ['stroke-style', 'dash-gap-short'],
        reference: '{stroke-style.dash-gap-short}',
        kind: 'composite-member',
        member: 'dashArray[1]',
      },
    ]);

    // border: a single object-member alias.
    expect(graph.getOutgoingEdges(['border', 'focusring'])).toEqual([
      {
        from: ['border', 'focusring'],
        to: ['color', 'focusring'],
        reference: '{color.focusring}',
        kind: 'composite-member',
        member: 'color',
      },
    ]);

    // shadow: a top-level array with both a token reference and a nested-object member alias.
    expect(graph.getOutgoingEdges(['shadow', 'mixed-reference'])).toEqual([
      {
        from: ['shadow', 'mixed-reference'],
        to: ['shadow', 'base'],
        reference: '{shadow.base}',
        kind: 'composite-member',
        member: '[0]',
      },
      {
        from: ['shadow', 'mixed-reference'],
        to: ['color', 'brand-accent'],
        reference: '{color.brand-accent}',
        kind: 'composite-member',
        member: '[1].color',
      },
    ]);

    // gradient: a top-level array of gradient-token references plus a nested-object alias.
    expect(graph.getOutgoingEdges(['gradient', 'with-references'])).toEqual([
      {
        from: ['gradient', 'with-references'],
        to: ['gradient', 'start-stop'],
        reference: '{gradient.start-stop}',
        kind: 'composite-member',
        member: '[0]',
      },
      {
        from: ['gradient', 'with-references'],
        to: ['color', 'brand-accent'],
        reference: '{color.brand-accent}',
        kind: 'composite-member',
        member: '[1].color',
      },
      {
        from: ['gradient', 'with-references'],
        to: ['gradient', 'end-stop'],
        reference: '{gradient.end-stop}',
        kind: 'composite-member',
        member: '[2]',
      },
    ]);

    // typography: every member aliased, spanning three different target $types.
    expect(graph.getOutgoingEdges(['typography', 'microcopy'])).toEqual([
      {
        from: ['typography', 'microcopy'],
        to: ['font', 'serif'],
        reference: '{font.serif}',
        kind: 'composite-member',
        member: 'fontFamily',
      },
      {
        from: ['typography', 'microcopy'],
        to: ['font', 'size', 'smallest'],
        reference: '{font.size.smallest}',
        kind: 'composite-member',
        member: 'fontSize',
      },
      {
        from: ['typography', 'microcopy'],
        to: ['font', 'weight', 'normal'],
        reference: '{font.weight.normal}',
        kind: 'composite-member',
        member: 'fontWeight',
      },
    ]);
  });
});
