/**
 * Prototype for #139: the value helpers the column view needs. They are copies of
 * `resolveValue` / `swatchColor` (`packages/viewer/src/resolve-value.ts`) and `resolveTokenTypes`
 * (`packages/viewer/src/build-graph.ts`), unchanged. They already take a core `TokenGraph`, but
 * importing them from `@dtgraph/viewer` loads sigma (the package has one entry point), which
 * fails outside a WebGL-capable browser. So they would move to core as they are.
 */
import type { TokenGraph } from '@dtgraph/core';

const UNTYPED = 'untyped';
const pathKey = (path: string[]): string => path.join('.');

export function resolveTokenTypes(graph: TokenGraph): Map<string, string> {
  const aliasTarget = new Map<string, string>();
  for (const edge of graph.edges) {
    if ((edge.kind ?? 'alias') === 'alias') aliasTarget.set(pathKey(edge.from), pathKey(edge.to));
  }
  const types = new Map<string, string>();
  const resolve = (start: string): string => {
    const known = types.get(start);
    if (known !== undefined) return known;
    const seen = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const own = graph.getNode(current.split('.'))?.type;
      if (own !== undefined) return own;
      current = aliasTarget.get(current);
    }
    return UNTYPED;
  };
  for (const node of graph.nodes) {
    const key = pathKey(node.path);
    types.set(key, resolve(key));
  }
  return types;
}

export interface ResolvedValue {
  /** The literal the alias chain ends on, or the raw value when it is not a plain alias. */
  value: unknown;
  /** The dotted path of the token that holds `value` (the token itself when not an alias). */
  from: string;
  /** Whether the chain was followed to a literal; false if it dangles or loops. */
  complete: boolean;
}

const ALIAS = /^\{([^}]+)\}$/;

/**
 * Follow a token's `$value` while it is a plain `{alias}` string, returning the literal at the
 * end. Composite values (objects/arrays with member aliases) are returned as-is: showing them
 * fully resolved is a job for a resolver, not a detail panel.
 */
export function resolveValue(graph: TokenGraph, path: string[]): ResolvedValue {
  const seen = new Set<string>();
  let current = path;
  let value: unknown = graph.getNode(current)?.value;
  for (;;) {
    const key = current.join('.');
    if (seen.has(key)) return { value, from: key, complete: false };
    seen.add(key);
    const match = typeof value === 'string' ? ALIAS.exec(value) : null;
    if (match === null) return { value, from: key, complete: true };
    const nextPath = match[1].split('.');
    const next = graph.getNode(nextPath);
    if (next === undefined) return { value, from: key, complete: false };
    current = nextPath;
    value = next.value;
  }
}

/**
 * A CSS color string for a resolved color value, if there is one to show: a plain string
 * (`"#3311ff"`, `"rebeccapurple"`), or a DTCG color object carrying a `hex` fallback.
 */
export function swatchColor(type: string | undefined, value: unknown): string | undefined {
  if (type !== 'color') return undefined;
  if (typeof value === 'string' && value.length <= 64 && !value.includes('{')) return value;
  if (typeof value === 'object' && value !== null && 'hex' in value) {
    const hex = (value as { hex?: unknown }).hex;
    if (typeof hex === 'string') return hex;
  }
  return undefined;
}
