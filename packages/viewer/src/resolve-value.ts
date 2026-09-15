import type { TokenGraph } from '@dtgraph/core';

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
