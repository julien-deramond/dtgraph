import type { TokenEdge, TokenGraph, TokenNode } from './types.js';

const INDENT = '  ';

function pathKey(path: string[]): string {
  return path.join('.');
}

/**
 * Characters that are written to a quoted Mermaid label as they are. Everything else in ASCII is
 * written as a Mermaid entity code (`#35;`), because Mermaid reads several of them as syntax even
 * inside quotes: `"` ends the label, `#…;` is an entity, a backtick opens a Markdown string, `<`
 * and `&` reach the HTML label, and a line holding `style`/`classDef`, then `:`, then `#…;` has
 * its last character cut by Mermaid's preprocessing. Characters outside ASCII (accents, CJK,
 * emoji) are kept, except the C1 controls and the Unicode line/paragraph separators.
 */
const SAFE_LABEL_CHAR = /^[A-Za-z0-9 ._\-/]$/;

/**
 * Escape a string for use inside a double-quoted Mermaid label (node text, subgraph title, edge
 * label). This is the only path token-derived text (path segments, member names) may reach the
 * returned diagram through.
 */
function escapeMermaidLabel(value: string): string {
  let escaped = '';
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    const keep =
      SAFE_LABEL_CHAR.test(char) ||
      (codePoint >= 0xa0 && codePoint !== 0x2028 && codePoint !== 0x2029);
    escaped += keep ? char : `#${codePoint};`;
  }
  return escaped;
}

/**
 * 32-bit FNV-1a hash of a string, in base 36: a short, stable fingerprint used to keep two
 * different paths that sanitize to the same id (`color.brand-1`, `color.brand_1`) apart.
 */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Hand out Mermaid ids from a safe alphabet (`[A-Za-z0-9_]`). The prefix keeps every id clear of
 * Mermaid keywords (`end`, `subgraph`, `style`…) and of the `o`/`x` edge-end markers, and keeps
 * token ids apart from subgraph ids. The id depends only on the key, so it stays the same when
 * other tokens are added or removed; a counter is appended only on a fingerprint collision.
 */
function createIdAllocator(prefix: string): (key: string) => string {
  const idByKey = new Map<string, string>();
  const usedIds = new Set<string>();
  return (key) => {
    const existing = idByKey.get(key);
    if (existing !== undefined) return existing;

    const base = `${prefix}_${key.replace(/[^A-Za-z0-9]+/g, '_')}_${fingerprint(key)}`;
    let id = base;
    for (let counter = 2; usedIds.has(id); counter++) {
      id = `${base}_${counter}`;
    }
    idByKey.set(key, id);
    usedIds.add(id);
    return id;
  };
}

export interface RenderTokenGraphToMermaidOptions {
  /**
   * Label each node with its full dotted path (`color.brand.primary`) instead of its last path
   * segment (`primary`). Defaults to `false`.
   */
  fullPaths?: boolean;
}

/**
 * Render a `TokenGraph` to Mermaid flowchart text, for pasting where Mermaid renders natively
 * (GitHub and GitLab Markdown, Notion, most docs tools): a `flowchart LR` with one `subgraph` per
 * top-level group, alias edges as `-->` and composite-member edges as dotted `-.->` arrows
 * labeled with the member. Edges point from the aliasing token to the token it references.
 * Root-level tokens sit outside any subgraph, and edges to tokens missing from the graph are
 * skipped.
 *
 * Every piece of token-derived text is escaped via {@link escapeMermaidLabel} and every id is
 * built from a safe alphabet, so the output stays one well-formed diagram whatever the token
 * names contain. Mermaid lays the diagram out itself and slows down past a couple hundred nodes
 * (renderers refuse it beyond their own limits: by default 50,000 characters or 500 edges), so
 * this is a format for sharing a slice of a token set, not for exploring a whole one.
 */
export function renderTokenGraphToMermaid(
  graph: TokenGraph,
  options: RenderTokenGraphToMermaidOptions = {},
): string {
  const fullPaths = options.fullPaths === true;
  const tokenId = createIdAllocator('t');
  const groupId = createIdAllocator('g');

  const rootNodes: TokenNode[] = [];
  const nodesByGroup = new Map<string, TokenNode[]>();
  for (const node of graph.nodes) {
    const group = node.path.length > 1 ? node.path[0] : undefined;
    if (group === undefined) {
      rootNodes.push(node);
      continue;
    }
    const members = nodesByGroup.get(group);
    if (members === undefined) {
      nodesByGroup.set(group, [node]);
    } else {
      members.push(node);
    }
  }

  const ids = new Set<string>();
  const nodeLine = (node: TokenNode, indent: string): string => {
    const key = pathKey(node.path);
    const id = tokenId(key);
    ids.add(key);
    const label = fullPaths ? key : (node.path[node.path.length - 1] ?? '');
    return `${indent}${id}["${escapeMermaidLabel(label)}"]`;
  };

  const lines = ['flowchart LR'];
  for (const [group, members] of nodesByGroup) {
    lines.push(`${INDENT}subgraph ${groupId(group)} ["${escapeMermaidLabel(group)}"]`);
    for (const node of members) lines.push(nodeLine(node, INDENT + INDENT));
    lines.push(`${INDENT}end`);
  }
  for (const node of rootNodes) lines.push(nodeLine(node, INDENT));

  const edgeLine = (edge: TokenEdge): string | undefined => {
    const from = pathKey(edge.from);
    const to = pathKey(edge.to);
    if (!ids.has(from) || !ids.has(to)) return undefined;
    const arrow =
      edge.kind !== 'composite-member'
        ? '-->'
        : edge.member !== undefined
          ? `-.->|"${escapeMermaidLabel(edge.member)}"|`
          : '-.->';
    return `${INDENT}${tokenId(from)} ${arrow} ${tokenId(to)}`;
  };
  for (const edge of graph.edges) {
    const line = edgeLine(edge);
    if (line !== undefined) lines.push(line);
  }

  return lines.join('\n');
}
