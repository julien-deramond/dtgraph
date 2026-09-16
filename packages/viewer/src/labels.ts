/**
 * Label typography and placement, shared by the canvas renderer and the SVG export so a
 * downloaded map reads like the one on screen. Kept in its own module (rather than in
 * `render.ts`) so the exporter can reuse it without pulling Sigma's WebGL programs in.
 */

/** Label typeface. Matches the viewer chrome's own font stack. */
export const LABEL_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Label size at rest, in pixels. */
export const LABEL_SIZE = 12;

/**
 * Side of the square grid, in pixels, that thins labels out: one label per cell, so a crowded
 * cluster shows its biggest tokens instead of a wall of overlapping text.
 */
export const LABEL_GRID_CELL_SIZE = 60;

/** Font size for a label: grows with the node's rendered size (like Gephi), within sane bounds. */
export function labelFontSize(nodeSize: number, baseSize: number): number {
  return Math.max(baseSize, Math.min(baseSize * 2.4, nodeSize * 1.2));
}

/** Where a label sits relative to its node's center: just past the dot, vertically centered. */
export function labelOffset(nodeSize: number, fontSize: number): { dx: number; dy: number } {
  return { dx: nodeSize + 4, dy: fontSize / 3 };
}

/**
 * Pick which nodes get a label: the largest node in each `cellSize` cell of the rendered image,
 * ties broken by key so the choice is deterministic. This is the same bargain Sigma's label grid
 * makes on the canvas, applied once to a fixed frame instead of on every camera move.
 */
export function selectGridLabels<T extends { key: string; x: number; y: number; size: number }>(
  nodes: readonly T[],
  cellSize: number,
): Set<string> {
  const winners = new Map<string, T>();
  for (const node of nodes) {
    const cell = `${Math.floor(node.x / cellSize)}:${Math.floor(node.y / cellSize)}`;
    const held = winners.get(cell);
    if (
      held === undefined ||
      node.size > held.size ||
      (node.size === held.size && node.key < held.key)
    ) {
      winners.set(cell, node);
    }
  }
  return new Set([...winners.values()].map((node) => node.key));
}
