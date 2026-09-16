/**
 * What the map is spotlighting right now, and what that means for one node or one edge. Kept in
 * its own module (rather than in `render.ts`) so the SVG exporter can ask the same questions the
 * canvas reducers ask without pulling Sigma's WebGL programs in: a downloaded map should show the
 * same tokens lit as the one on screen.
 */

import type { ViewerGraph } from './build-graph.js';
import { edgeInFocus, type FocusSets } from './focus.js';

/**
 * Mutable interaction state the Sigma reducers read on every frame. Kept as a plain object (not
 * closed-over `let`s) so the mount code can update it and just ask Sigma to refresh.
 */
export interface InteractionState {
  hovered: string | null;
  /** The hovered node plus its direct neighbors in both directions. */
  neighborhood: Set<string>;
  /** The clicked/searched token, if any, with its transitive relations. */
  selected: string | null;
  focus: FocusSets | null;
  /** A legend category to show alone (everything else dims), keyed like `categoryOf`. */
  solo: string | null;
  categoryOf: (node: string) => string;
}

export function createInteractionState(
  categoryOf: (node: string) => string = () => '',
): InteractionState {
  return {
    hovered: null,
    neighborhood: new Set(),
    selected: null,
    focus: null,
    solo: null,
    categoryOf,
  };
}

/** How a node or an edge should draw given the current interaction state. */
export type Emphasis = 'lit' | 'normal' | 'dimmed';

/**
 * Thickness of a lit edge, in pixels: a chain in the spotlight reads as a line rather than as
 * the texture the rest of the map fades into.
 */
export const LIT_EDGE_THICKNESS = 1.6;

/**
 * The token the spotlight is about: the hovered one while a pointer is on the map, otherwise the
 * selected one. Its direct neighbors keep their labels whatever the label grid says.
 */
export function emphasisAnchor(state: InteractionState): string | null {
  return state.hovered ?? state.selected;
}

/** Whether `node` is the anchor itself or one of its direct neighbors. */
export function isAnchored(graph: ViewerGraph, state: InteractionState, node: string): boolean {
  const anchor = emphasisAnchor(state);
  return anchor !== null && (node === anchor || graph.areNeighbors(anchor, node));
}

export function nodeEmphasis(state: InteractionState, node: string): Emphasis {
  if (state.solo !== null && state.categoryOf(node) !== state.solo) return 'dimmed';
  if (state.hovered !== null) return state.neighborhood.has(node) ? 'lit' : 'dimmed';
  if (state.selected !== null && state.focus !== null) {
    if (node === state.selected) return 'lit';
    return state.focus.all.has(node) ? 'lit' : 'dimmed';
  }
  return 'normal';
}

export function edgeEmphasis(graph: ViewerGraph, state: InteractionState, edge: string): Emphasis {
  const [source, target] = graph.extremities(edge);
  if (state.solo !== null) {
    if (state.categoryOf(source) !== state.solo && state.categoryOf(target) !== state.solo) {
      return 'dimmed';
    }
  }
  if (state.hovered !== null) {
    return source === state.hovered || target === state.hovered ? 'lit' : 'dimmed';
  }
  if (state.selected !== null && state.focus !== null) {
    return edgeInFocus(graph, edge, state.selected, state.focus) ? 'lit' : 'dimmed';
  }
  return 'normal';
}
