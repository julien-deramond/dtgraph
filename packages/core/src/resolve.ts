import { DtcgParseError } from './errors.js';
import type { TokenEdge, TokenNode, TokenTreeNode } from './types.js';

const ALIAS_SPEC_URL = 'https://www.designtokens.org/tr/2025.10/format/#aliases-references';

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

/**
 * Resolve `{group.path.to.token}` alias references in token `$value`s into graph edges.
 * Each edge is a single hop — an alias pointing to another alias produces two edges
 * (one per hop), not one collapsed through to the final value. Composite `$value`s
 * (objects containing nested aliases) are not inspected here.
 */
export function resolveAliasEdges(tree: TokenTreeNode): TokenEdge[] {
  const tokensByPath = new Map<string, TokenNode>();
  collectTokens(tree, tokensByPath);

  const edges: TokenEdge[] = [];
  for (const token of tokensByPath.values()) {
    const reference = parseAliasReference(token.value);
    if (reference === undefined) continue;

    const targetPath = reference.join('.');
    const target = tokensByPath.get(targetPath);
    if (target === undefined) {
      throw new DtcgParseError(
        `Alias "{${targetPath}}" does not resolve to any known token`,
        token.path,
        ALIAS_SPEC_URL,
      );
    }

    edges.push({ from: token.path, to: target.path, reference: token.value as string });
  }
  return edges;
}
