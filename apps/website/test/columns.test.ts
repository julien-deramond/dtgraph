import { buildTokenGraphFromDocuments } from '@dtgraph/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aliasDepths,
  collectDownstream,
  collectUpstream,
  focusEdges,
  matchesQuery,
} from '../src/lib/columns/graph.js';
import { mountColumns } from '../src/lib/columns/mount.js';
import { sourcesByPath } from '../src/lib/columns/sources.js';
import { syntheticTokenSet } from '../src/lib/columns/synthetic.js';
import { assignColumns, familyOf } from '../src/lib/columns/tiers.js';
import { buildTokenGraphFromFiles } from '../src/lib/playground.js';

// core → semantic → component, plus one component that skips straight to core, one literal
// component value, and a semantic token aliasing another semantic token.
const DOC = {
  color: {
    violet: { 600: { $type: 'color', $value: '#7c3aed' } },
    gray: { 900: { $type: 'color', $value: '#111111' } },
  },
  fg: {
    accent: { $value: '{color.violet.600}' },
    link: { $value: '{fg.accent}' },
  },
  action: {
    'fg-link': { $value: '{fg.link}' },
    'fg-selected': { $value: '{fg.accent}' },
    'fg-raw': { $value: '{color.gray.900}' },
    padding: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
  },
};

const graph = () => buildTokenGraphFromDocuments([{ source: 'tokens.json', document: DOC }]).graph;

describe('column graph helpers', () => {
  it('computes alias depth', () => {
    const depths = aliasDepths(graph());
    expect(depths.get('color.violet.600')).toBe(0);
    expect(depths.get('fg.accent')).toBe(1);
    expect(depths.get('fg.link')).toBe(2);
    expect(depths.get('action.fg-link')).toBe(3);
    expect(depths.get('action.padding')).toBe(0);
  });

  it('collects transitive chains both ways', () => {
    const g = graph();
    expect([...collectUpstream(g, 'action.fg-link')].sort()).toEqual([
      'color.violet.600',
      'fg.accent',
      'fg.link',
    ]);
    expect([...collectDownstream(g, 'fg.accent')].sort()).toEqual([
      'action.fg-link',
      'action.fg-selected',
      'fg.link',
    ]);
  });

  it('draws one hop or the full chain', () => {
    const g = graph();
    const hop = focusEdges(g, 'fg.link', false).map((e) => `${e.from.join('.')}>${e.to.join('.')}`);
    expect(hop.sort()).toEqual(['action.fg-link>fg.link', 'fg.link>fg.accent']);
    const chain = focusEdges(g, 'fg.link', true).map(
      (e) => `${e.from.join('.')}>${e.to.join('.')}`,
    );
    expect(chain.sort()).toEqual([
      'action.fg-link>fg.link',
      'fg.accent>color.violet.600',
      'fg.link>fg.accent',
    ]);
  });

  it('matches every query term against the path', () => {
    expect(matchesQuery('action.fg-link', 'act link')).toBe(true);
    expect(matchesQuery('action.fg-link', 'act bg')).toBe(false);
    expect(matchesQuery('action.fg-link', '  ')).toBe(true);
  });
});

describe('assignColumns', () => {
  it('places whole groups by their role, keeping literal component values with the rest', () => {
    const { columns, columnOf } = assignColumns(graph(), 'group-role');
    expect(columns.map((c) => c.label)).toEqual(['Core', 'Semantic', 'Component']);
    expect(columnOf.get('color.gray.900')).toBe(0);
    expect(columnOf.get('fg.link')).toBe(1);
    expect(columnOf.get('action.fg-raw')).toBe(2);
    expect(columnOf.get('action.padding')).toBe(2);
  });

  it('lets a token pin its column through $extensions', () => {
    const doc = structuredClone(DOC) as typeof DOC & Record<string, unknown>;
    (doc.fg.link as Record<string, unknown>).$extensions = { 'com.dtgraph.tier': 'component' };
    const g = buildTokenGraphFromDocuments([{ source: 't.json', document: doc }]).graph;
    expect(assignColumns(g, 'group-role').columnOf.get('fg.link')).toBe(2);
  });

  it('gives alias depth one column per level', () => {
    const { columns, columnOf } = assignColumns(graph(), 'depth');
    expect(columns).toHaveLength(4);
    expect(columnOf.get('action.padding')).toBe(0);
  });

  it('orders source folders by which reference which', () => {
    const files = [
      { source: 'component/action.json', content: JSON.stringify({ action: DOC.action }) },
      { source: 'semantic/fg.json', content: JSON.stringify({ fg: DOC.fg }) },
      { source: 'primitive/color.json', content: JSON.stringify({ color: DOC.color }) },
    ];
    const { graph: g } = buildTokenGraphFromFiles(files);
    // Plain multi-file builds don't tag TokenNode.source; the page rebuilds it from the files.
    expect(g.nodes.every((node) => node.source === undefined)).toBe(true);
    const sources = sourcesByPath(files);
    const { columns, columnOf } = assignColumns(g, 'source', (n) => sources.get(n.path.join('.')));
    expect(columns.map((c) => c.label)).toEqual(['primitive', 'semantic', 'component']);
    expect(columnOf.get('action.padding')).toBe(2);
  });

  it('names families by their first segments', () => {
    expect(familyOf(['color', 'violet', '600'])).toBe('color.violet');
    expect(familyOf(['spacing', '4'])).toBe('spacing');
    expect(familyOf(['root'])).toBe('');
  });
});

describe('syntheticTokenSet', () => {
  it('stays under the playground caps', () => {
    const { graph: g } = buildTokenGraphFromFiles([
      { source: 'large.json', content: JSON.stringify(syntheticTokenSet()) },
    ]);
    expect(g.nodes.length).toBeGreaterThan(4500);
    expect(g.nodes.length).toBeLessThanOrEqual(5000);
  });
});

describe('mountColumns', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders a row per token and announces the focused lineage', () => {
    const container = document.createElement('div');
    const view = mountColumns(container, graph());
    expect(container.querySelectorAll('.dtcols__row')).toHaveLength(8);
    expect([...container.querySelectorAll('.dtcols__badge')].map((b) => b.textContent)).toEqual([
      '2',
      '2',
      '4',
    ]);

    view.select('fg.accent');
    const pressed = container.querySelector('[aria-pressed="true"]') as HTMLElement;
    expect(pressed.dataset.key).toBe('fg.accent');
    expect(container.querySelector('[data-key="color.violet.600"]')?.getAttribute('data-rel')).toBe(
      'upstream',
    );
    expect(container.querySelector('.dtcols__detail')?.textContent).toContain(
      'Used by 2 (direct): fg.link, action.fg-selected',
    );

    view.setFilter('link', 'all');
    expect([...container.querySelectorAll('.dtcols__badge')].map((b) => b.textContent)).toEqual([
      '0 / 2',
      '1 / 2',
      '1 / 4',
    ]);
    view.destroy();
    expect(container.childElementCount).toBe(0);
  });
});
