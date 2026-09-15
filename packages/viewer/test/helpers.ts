import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  resolveAliasEdgesAcrossFiles,
  type TokenGraph,
} from '@dtgraph/core';

/** Parse one DTCG document into a resolved `TokenGraph`, the way every consumer does. */
export function tokenGraphFrom(document: unknown): TokenGraph {
  const tree = parseTokenTree(document);
  const named = [{ source: 'test.json', tree }];
  return buildTokenGraph(flattenTokenTree(tree), resolveAliasEdgesAcrossFiles(named));
}

/** primitives → semantic → component, plus two isolated tokens and one composite. */
export const SAMPLE = {
  color: {
    blue: { $type: 'color', $value: '#3b82f6' },
    gray: { $type: 'color', $value: '#111827' },
    unused: { $type: 'color', $value: '#000000' },
  },
  semantic: {
    primary: { $type: 'color', $value: '{color.blue}' },
    text: { $type: 'color', $value: '{color.gray}' },
  },
  button: {
    background: { $value: '{semantic.primary}' },
    text: { $value: '{semantic.text}' },
    border: {
      $type: 'border',
      $value: { color: '{color.gray}', width: { value: 1, unit: 'px' }, style: 'solid' },
    },
  },
  spacing: {
    md: { $type: 'dimension', $value: { value: 1, unit: 'rem' } },
  },
};
