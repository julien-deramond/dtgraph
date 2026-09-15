import { DtcgParseError } from './errors.js';
import type { GroupNode, TokenNode, TokenTreeNode } from './types.js';

const SPEC_BASE = 'https://www.designtokens.org/tr/2025.10/format/';

const SPEC = {
  root: `${SPEC_BASE}#file-format`,
  group: `${SPEC_BASE}#groups`,
  token: `${SPEC_BASE}#design-token-0`,
  type: `${SPEC_BASE}#type-0`,
  description: `${SPEC_BASE}#description`,
  extensions: `${SPEC_BASE}#extensions`,
} as const;

const RESERVED_TOKEN_KEYS = new Set(['$value', '$type', '$description', '$extensions']);
const RESERVED_GROUP_KEYS = new Set(['$type', '$description', '$extensions']);
/** Allowed on the root group only: a JSON Schema hint for editors, carrying no token meaning. */
const ROOT_ONLY_KEYS = new Set(['$schema']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/** Parse a raw DTCG JSON document into a token tree. Does not resolve aliases. */
export function parseTokenTree(document: unknown): TokenTreeNode {
  if (!isPlainObject(document)) {
    throw new DtcgParseError(
      `A DTCG token document must be a JSON object, got ${describeType(document)}`,
      [],
      SPEC.root,
    );
  }
  return parseNode(document, [], undefined);
}

/** Flatten a parsed token tree into every `TokenNode` it contains, in document order. */
export function flattenTokenTree(tree: TokenTreeNode): TokenNode[] {
  const nodes: TokenNode[] = [];
  collectTokenNodes(tree, nodes);
  return nodes;
}

function collectTokenNodes(node: TokenTreeNode, nodes: TokenNode[]): void {
  if (node.kind === 'token') {
    nodes.push(node);
    return;
  }
  for (const child of Object.values(node.children)) {
    collectTokenNodes(child, nodes);
  }
}

function parseNode(
  node: Record<string, unknown>,
  path: string[],
  inheritedType: string | undefined,
): TokenTreeNode {
  const name = path[path.length - 1] ?? '';
  const isToken = Object.prototype.hasOwnProperty.call(node, '$value');
  return isToken
    ? parseTokenNode(node, name, path, inheritedType)
    : parseGroupNode(node, name, path, inheritedType);
}

function parseTokenNode(
  node: Record<string, unknown>,
  name: string,
  path: string[],
  inheritedType: string | undefined,
): TokenNode {
  const strayKeys = Object.keys(node).filter((key) => !RESERVED_TOKEN_KEYS.has(key));
  if (strayKeys.length > 0) {
    throw new DtcgParseError(
      `Token has "$value" but also has ${strayKeys.length === 1 ? 'property' : 'properties'} ` +
        `${strayKeys.map((key) => `"${key}"`).join(', ')} — a node with "$value" is a token ` +
        'and cannot also contain child tokens or groups',
      path,
      SPEC.token,
    );
  }

  const ownType = readOptionalType(node.$type, path);

  return {
    kind: 'token',
    name,
    path,
    value: node.$value,
    type: ownType ?? inheritedType,
    description: readOptionalDescription(node.$description, path),
    extensions: readOptionalExtensions(node.$extensions, path),
  };
}

function parseGroupNode(
  node: Record<string, unknown>,
  name: string,
  path: string[],
  inheritedType: string | undefined,
): GroupNode {
  const ownType = readOptionalType(node.$type, path);
  const effectiveType = ownType ?? inheritedType;

  const children: Record<string, TokenTreeNode> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      if (ROOT_ONLY_KEYS.has(key)) {
        if (path.length > 0) {
          throw new DtcgParseError(
            `Property "${key}" is only allowed at the document root, not on a nested group`,
            path,
            SPEC.group,
          );
        }
        continue;
      }
      if (!RESERVED_GROUP_KEYS.has(key)) {
        throw new DtcgParseError(`Unknown reserved property "${key}" on a group`, path, SPEC.group);
      }
      continue;
    }
    if (key.length === 0) {
      throw new DtcgParseError('Group and token names must not be empty', path, SPEC.group);
    }
    if (!isPlainObject(value)) {
      throw new DtcgParseError(
        `Child "${key}" must be an object (a token or a group), got ${describeType(value)}`,
        [...path, key],
        SPEC.group,
      );
    }
    children[key] = parseNode(value, [...path, key], effectiveType);
  }

  return {
    kind: 'group',
    name,
    path,
    type: ownType,
    description: readOptionalDescription(node.$description, path),
    extensions: readOptionalExtensions(node.$extensions, path),
    children,
  };
}

function readOptionalType(value: unknown, path: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new DtcgParseError('"$type" must be a non-empty string', path, SPEC.type);
  }
  return value;
}

function readOptionalDescription(value: unknown, path: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new DtcgParseError('"$description" must be a string', path, SPEC.description);
  }
  return value;
}

function readOptionalExtensions(
  value: unknown,
  path: string[],
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    throw new DtcgParseError('"$extensions" must be an object', path, SPEC.extensions);
  }
  return value;
}
