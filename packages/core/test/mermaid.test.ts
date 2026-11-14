import { describe, expect, it } from 'vitest';

import { buildTokenGraph } from '../src/graph.js';
import { renderTokenGraphToMermaid } from '../src/mermaid.js';
import type { TokenEdge, TokenNode } from '../src/types.js';

function token(path: string[], overrides: Partial<TokenNode> = {}): TokenNode {
  return {
    kind: 'token',
    name: path[path.length - 1] ?? '',
    path,
    value: '#000000',
    ...overrides,
  };
}

/** The id Mermaid sees for the node whose label is `label`. */
function idOf(mermaid: string, label: string): string {
  const match = mermaid
    .split('\n')
    .map((line) => /^\s*(t_\w+)\["(.*)"\]$/.exec(line))
    .find((found) => found?.[2] === label);
  if (match === undefined || match === null) throw new Error(`no node labeled ${label}`);
  return match[1] ?? '';
}

describe('renderTokenGraphToMermaid', () => {
  const nodes = [
    token(['color', 'brand']),
    token(['color', 'accent'], { value: '{color.brand}' }),
    token(['border', 'focus'], { value: {} }),
    token(['opacity']),
  ];
  const edges: TokenEdge[] = [
    {
      from: ['color', 'accent'],
      to: ['color', 'brand'],
      reference: '{color.brand}',
      kind: 'alias',
    },
    {
      from: ['border', 'focus'],
      to: ['color', 'brand'],
      reference: '{color.brand}',
      kind: 'composite-member',
      member: 'color',
    },
  ];

  it('renders a left-to-right flowchart with one subgraph per top-level group', () => {
    const mermaid = renderTokenGraphToMermaid(buildTokenGraph(nodes, edges));
    const lines = mermaid.split('\n');

    expect(lines[0]).toBe('flowchart LR');
    expect(lines.filter((line) => line.trim().startsWith('subgraph '))).toEqual([
      expect.stringMatching(/^ {2}subgraph g_color_\w+ \["color"\]$/),
      expect.stringMatching(/^ {2}subgraph g_border_\w+ \["border"\]$/),
    ]);
    expect(lines.filter((line) => line.trim() === 'end')).toHaveLength(2);
    // Tokens sit in their group's subgraph, labeled by their last path segment.
    const colorGroup = lines.slice(1, lines.indexOf('  end'));
    expect(colorGroup).toEqual([
      expect.stringMatching(/subgraph/),
      expect.stringMatching(/^ {4}t_color_brand_\w+\["brand"\]$/),
      expect.stringMatching(/^ {4}t_color_accent_\w+\["accent"\]$/),
    ]);
    // A root-level token has no group, so it sits outside every subgraph.
    expect(lines).toContainEqual(expect.stringMatching(/^ {2}t_opacity_\w+\["opacity"\]$/));
  });

  it('draws alias edges as solid arrows and composite members as labeled dotted arrows', () => {
    const mermaid = renderTokenGraphToMermaid(buildTokenGraph(nodes, edges));
    const brand = idOf(mermaid, 'brand');

    expect(mermaid).toContain(`  ${idOf(mermaid, 'accent')} --> ${brand}`);
    expect(mermaid).toContain(`  ${idOf(mermaid, 'focus')} -.->|"color"| ${brand}`);
  });

  it('treats an edge without a kind as an alias, and a member-less composite edge as unlabeled', () => {
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph(nodes, [
        { from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' },
        {
          from: ['border', 'focus'],
          to: ['color', 'brand'],
          reference: '{color.brand}',
          kind: 'composite-member',
        },
      ]),
    );
    const brand = idOf(mermaid, 'brand');

    expect(mermaid).toContain(`${idOf(mermaid, 'accent')} --> ${brand}`);
    expect(mermaid).toContain(`${idOf(mermaid, 'focus')} -.-> ${brand}`);
  });

  it('labels nodes with their full path when fullPaths is set', () => {
    const mermaid = renderTokenGraphToMermaid(buildTokenGraph(nodes, edges), { fullPaths: true });

    expect(mermaid).toMatch(/t_color_brand_\w+\["color\.brand"\]/);
    expect(mermaid).toMatch(/t_border_focus_\w+\["border\.focus"\]/);
    expect(mermaid).toMatch(/t_opacity_\w+\["opacity"\]/);
  });

  it('skips edges whose ends are not in the graph', () => {
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph(
        [token(['color', 'brand'])],
        [{ from: ['color', 'accent'], to: ['color', 'brand'], reference: '{color.brand}' }],
      ),
    );

    expect(mermaid).not.toContain('-->');
  });

  it('renders an empty graph as a bare flowchart header', () => {
    expect(renderTokenGraphToMermaid(buildTokenGraph([], []))).toBe('flowchart LR');
  });

  it('gives each token a stable id that does not depend on the rest of the graph', () => {
    const alone = renderTokenGraphToMermaid(buildTokenGraph([token(['color', 'brand'])], []));
    const among = renderTokenGraphToMermaid(buildTokenGraph(nodes, edges));

    expect(idOf(among, 'brand')).toBe(idOf(alone, 'brand'));
    expect(renderTokenGraphToMermaid(buildTokenGraph(nodes, edges))).toBe(among);
  });

  it('keeps paths that sanitize to the same characters apart', () => {
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph(
        [token(['space', 'gap-1']), token(['space', 'gap_1']), token(['space', 'gap 1'])],
        [],
      ),
    );
    const ids = ['gap-1', 'gap_1', 'gap 1'].map((label) => idOf(mermaid, label));

    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^t_space_gap_1_[a-z0-9]+$/);
  });

  it('builds every id from a safe alphabet, clear of Mermaid keywords and edge markers', () => {
    const awkward = ['end', 'subgraph', 'o', 'x', 'style', 'click', '-->', 'émoji 🎨'];
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph(
        awkward.flatMap((name) => [token([name]), token([name, name])]),
        [],
      ),
    );
    const ids = mermaid
      .split('\n')
      .slice(1)
      .filter((line) => line.trim() !== 'end')
      .map((line) => /^\s*(?:subgraph )?(\S+?)(?: |\[)/.exec(line)?.[1]);

    expect(ids).toHaveLength(awkward.length * 3);
    for (const id of ids) expect(id).toMatch(/^[tg]_[A-Za-z0-9_]+$/);
  });

  it('escapes every character Mermaid could read as syntax inside a label', () => {
    const hostile = [
      'quo"te',
      '#35;',
      '<script>alert(1)</script>',
      '[x]{y}(z)|w',
      '`md`',
      'style:x #1;',
      '%% comment',
      'a&amp;b',
      'two\nlines',
    ];
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph(
        hostile.map((name) => token(['group ' + name, name])),
        hostile.slice(1).map((name) => ({
          from: ['group ' + name, name],
          to: ['group quo"te', 'quo"te'],
          reference: '{x}',
          kind: 'composite-member' as const,
          member: name,
        })),
      ),
    );
    const lines = mermaid.split('\n');

    // One line per header, subgraph start/end, node and edge: nothing broke out of its line.
    expect(lines).toHaveLength(1 + hostile.length * 3 + (hostile.length - 1));
    // Every quoted label holds only plain characters and Mermaid entity codes.
    const labels = [...mermaid.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? '');
    expect(labels).toHaveLength(hostile.length * 3 - 1);
    for (const label of labels) {
      expect(label.replace(/#\d+;/g, '')).toMatch(/^[A-Za-z0-9 ._\-/]*$/);
    }
    expect(mermaid).toContain('["quo#34;te"]');
    expect(mermaid).toContain('["#35;35#59;"]');
    expect(mermaid).toContain('["#60;script#62;alert#40;1#41;#60;/script#62;"]');
    // No literal colon reaches the text, so Mermaid's `style …:…#…;` preprocessing never fires.
    expect(mermaid).not.toContain(':');
  });

  it('keeps non-ASCII text as it is', () => {
    const mermaid = renderTokenGraphToMermaid(
      buildTokenGraph([token(['couleur', 'thème 🎨'])], []),
    );

    expect(mermaid).toContain('["thème 🎨"]');
    expect(mermaid).toContain('["couleur"]');
  });
});
