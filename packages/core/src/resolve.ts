import { DtcgParseError } from './errors.js';
import type { TokenEdge, TokenNode, TokenTreeNode } from './types.js';

const ALIAS_SPEC_URL = 'https://www.designtokens.org/tr/2025.10/format/#aliases-references';
const GROUP_SPEC_URL = 'https://www.designtokens.org/tr/2025.10/format/#groups';
const CIRCULAR_SPEC_URL = 'https://www.designtokens.org/tr/2025.10/format/#circular-references';

const ALIAS_PATTERN = /^\{([^{}]+)\}$/;

/** Extract the dot-separated path a `{...}` alias reference points to, or undefined if not an alias. */
function parseAliasReference(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  const match = ALIAS_PATTERN.exec(value);
  return match === null ? undefined : match[1].split('.');
}

function collectTokens(node: TokenTreeNode, tokensByPath: Map<string, TokenNode>): void {
  if (node.kind === 'token') {
    tokensByPath.set(node.path.join('.'), node);
    return;
  }
  for (const child of Object.values(node.children)) {
    collectTokens(child, tokensByPath);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveReference(
  token: TokenNode,
  targetPath: string,
  tokensByPath: Map<string, TokenNode>,
): TokenNode {
  const target = tokensByPath.get(targetPath);
  if (target === undefined) {
    throw new DtcgParseError(
      `Alias "{${targetPath}}" does not resolve to any known token`,
      token.path,
      ALIAS_SPEC_URL,
    );
  }
  return target;
}

/**
 * Walk a composite `$value` (an object like `border`/`typography`, or an array like a
 * layered `shadow`/`gradient`) one level deep, emitting a `composite-member` edge for each
 * member (or array element) that is itself a `{...}` alias reference. Nested composite
 * objects reached through an array element (e.g. an inline shadow layer, a gradient stop)
 * are walked too, since the spec allows those to carry member-level aliases of their own.
 */
function collectCompositeMemberEdges(
  token: TokenNode,
  value: unknown,
  memberPrefix: string | undefined,
  tokensByPath: Map<string, TokenNode>,
  edges: TokenEdge[],
): void {
  if (Array.isArray(value)) {
    value.forEach((element, index) => {
      const member = memberPrefix === undefined ? `[${index}]` : `${memberPrefix}[${index}]`;
      const reference = parseAliasReference(element);
      if (reference !== undefined) {
        const targetPath = reference.join('.');
        const target = resolveReference(token, targetPath, tokensByPath);
        edges.push({
          from: token.path,
          to: target.path,
          reference: `{${targetPath}}`,
          kind: 'composite-member',
          member,
        });
        return;
      }
      collectCompositeMemberEdges(token, element, member, tokensByPath, edges);
    });
    return;
  }

  if (!isPlainObject(value)) return;

  for (const [key, memberValue] of Object.entries(value)) {
    const member = memberPrefix === undefined ? key : `${memberPrefix}.${key}`;
    const reference = parseAliasReference(memberValue);
    if (reference !== undefined) {
      const targetPath = reference.join('.');
      const target = resolveReference(token, targetPath, tokensByPath);
      edges.push({
        from: token.path,
        to: target.path,
        reference: `{${targetPath}}`,
        kind: 'composite-member',
        member,
      });
      continue;
    }
    if (Array.isArray(memberValue)) {
      collectCompositeMemberEdges(token, memberValue, member, tokensByPath, edges);
    }
    // A member that is itself an inline composite object (e.g. an inline `strokeStyle`
    // object on a `border.style` member) is intentionally not walked further here.
  }
}

/**
 * Reject a set of edges that contains an alias cycle (direct, e.g. A → B → A, or indirect,
 * e.g. A → B → C → A). Runs a DFS over `from -> to`, reporting the full cycle path in the
 * error the moment a node still on the current DFS stack ("gray") is revisited.
 */
function detectAliasCycle(edges: TokenEdge[]): void {
  const edgesByFrom = new Map<string, TokenEdge[]>();
  for (const edge of edges) {
    const from = edge.from.join('.');
    const outgoing = edgesByFrom.get(from);
    if (outgoing === undefined) {
      edgesByFrom.set(from, [edge]);
    } else {
      outgoing.push(edge);
    }
  }

  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  function visit(node: string): void {
    state.set(node, IN_PROGRESS);
    stack.push(node);

    for (const edge of edgesByFrom.get(node) ?? []) {
      const next = edge.to.join('.');
      const nextState = state.get(next) ?? UNVISITED;
      if (nextState === IN_PROGRESS) {
        const cycleStart = stack.indexOf(next);
        const cyclePath = [...stack.slice(cycleStart), next];
        throw new DtcgParseError(
          `Alias cycle detected: ${cyclePath.join(' → ')}`,
          cyclePath[0].split('.'),
          CIRCULAR_SPEC_URL,
        );
      }
      if (nextState === UNVISITED) {
        visit(next);
      }
    }

    stack.pop();
    state.set(node, DONE);
  }

  for (const node of edgesByFrom.keys()) {
    if ((state.get(node) ?? UNVISITED) === UNVISITED) {
      visit(node);
    }
  }
}

function resolveEdgesFromTokenMap(tokensByPath: Map<string, TokenNode>): TokenEdge[] {
  const edges: TokenEdge[] = [];
  for (const token of tokensByPath.values()) {
    const reference = parseAliasReference(token.value);
    if (reference !== undefined) {
      const targetPath = reference.join('.');
      const target = resolveReference(token, targetPath, tokensByPath);
      edges.push({ from: token.path, to: target.path, reference: token.value as string });
      continue;
    }

    collectCompositeMemberEdges(token, token.value, undefined, tokensByPath, edges);
  }
  detectAliasCycle(edges);
  return edges;
}

/**
 * Resolve `{group.path.to.token}` alias references in token `$value`s into graph edges.
 * Each edge is a single hop — an alias pointing to another alias produces two edges
 * (one per hop), not one collapsed through to the final value.
 *
 * Scalar `$value`s that are entirely an alias produce a plain edge (`kind` unset). Composite
 * `$value`s (an object like `border`/`typography`, or an array like a layered `shadow`) are
 * walked one level deep for member aliases, producing `kind: "composite-member"` edges
 * tagged with which member (or array index) the alias came from.
 *
 * Rejects the graph — rather than silently truncating it — if the resulting edges contain an
 * alias cycle (direct or indirect), so callers can trust the returned edges are never in an
 * ambiguous state.
 */
export function resolveAliasEdges(tree: TokenTreeNode): TokenEdge[] {
  const tokensByPath = new Map<string, TokenNode>();
  collectTokens(tree, tokensByPath);
  return resolveEdgesFromTokenMap(tokensByPath);
}

/** One parsed file to merge via {@link resolveAliasEdgesAcrossFiles}. */
export interface NamedTokenTree {
  /** Identifier for this file (e.g. its path). Recorded on each token's `source` and used in collision error messages. */
  source: string;
  tree: TokenTreeNode;
}

/**
 * Merge multiple parsed token trees into a single addressable token space, tagging each
 * token's `source`, then resolve aliases (scalar and composite-member) against that merged
 * space — so an alias in one file can point at a token defined in another.
 *
 * Throws a `DtcgParseError` if two files define a token at the same path.
 */
export function resolveAliasEdgesAcrossFiles(files: NamedTokenTree[]): TokenEdge[] {
  const tokensByPath = new Map<string, TokenNode>();
  for (const file of files) {
    const fileTokens = new Map<string, TokenNode>();
    collectTokens(file.tree, fileTokens);

    for (const [path, token] of fileTokens) {
      const existing = tokensByPath.get(path);
      if (existing !== undefined) {
        throw new DtcgParseError(
          `Token "${path}" is defined in both "${existing.source}" and "${file.source}"`,
          token.path,
          GROUP_SPEC_URL,
        );
      }
      tokensByPath.set(path, { ...token, source: file.source });
    }
  }
  return resolveEdgesFromTokenMap(tokensByPath);
}
