import { circular } from 'graphology-layout';
import forceAtlas2, { type ForceAtlas2Settings } from 'graphology-layout-forceatlas2';

import { SMALL_GRAPH_ORDER, type ViewerGraph } from './build-graph.js';

export interface LayoutOptions {
  /**
   * ForceAtlas2 iterations. Defaults to a count that shrinks as the graph grows, so a few hundred
   * tokens settle fully while a few thousand still lay out in well under a second.
   */
  iterations?: number;
  /** Overrides merged on top of the viewer's ForceAtlas2 settings (e.g. `{ linLogMode: true }`). */
  settings?: ForceAtlas2Settings;
}

/** Default iteration count for a graph with `order` nodes. */
export function defaultIterations(order: number): number {
  if (order <= 200) return 400;
  if (order <= 1000) return 250;
  if (order <= 3000) return 180;
  return 120;
}

/**
 * ForceAtlas2 settings for a token graph, starting from graphology's size-inferred defaults:
 *
 * - `slowDown: 1` — the inferred value grows with graph size and leaves a thousand-node graph
 *   barely moved after hundreds of iterations.
 * - `barnesHutOptimize: true` — a few hundred milliseconds instead of seconds at that size.
 * - `linLogMode: true` — clusters stay readable as clusters; plain mode collapses every consumer
 *   onto its hub into star-shaped blobs.
 * - `adjustSizes: true` — nodes repel by their rendered size, so heavily-used primitives don't
 *   get buried under the tokens that alias them.
 */
export function forceAtlas2Settings(
  graph: ViewerGraph,
  overrides: ForceAtlas2Settings = {},
): ForceAtlas2Settings {
  return {
    ...forceAtlas2.inferSettings(graph),
    slowDown: 1,
    barnesHutOptimize: true,
    linLogMode: true,
    adjustSizes: true,
    ...overrides,
  };
}

interface Satellite {
  nodes: string[];
  radius: number;
}

/**
 * Pack `nodes` into a compact disc around (`cx`, `cy`): one at the center, then concentric rings
 * of `6k` nodes at radius `k * spacing`. Returns the disc's outer radius.
 */
function packDisc(
  graph: ViewerGraph,
  nodes: string[],
  cx: number,
  cy: number,
  spacing: number,
): number {
  let index = 0;
  let ring = 0;
  while (index < nodes.length) {
    const capacity = ring === 0 ? 1 : 6 * ring;
    const count = Math.min(capacity, nodes.length - index);
    const radius = ring * spacing;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      graph.mergeNodeAttributes(nodes[index + i], {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }
    index += count;
    ring += 1;
  }
  return Math.max(ring - 1, 0) * spacing + spacing / 2;
}

/**
 * Place isolated tokens (no edges at all) as small satellite discs around the connected layout,
 * one disc per top-level group, instead of letting ForceAtlas2 scatter them: gravity alone would
 * pile them into a shapeless cloud at the center, on top of the clusters that carry the actual
 * structure. Grouping them keeps same-colored tokens together, so a design system's unaliased
 * component tokens read as a ring of small labeled-by-color moons around the core.
 */
export function placeIsolatesAsSatellites(graph: ViewerGraph): void {
  const byGroup = new Map<string, string[]>();
  const connected: string[] = [];
  graph.forEachNode((node, attrs) => {
    if (graph.degree(node) > 0) {
      connected.push(node);
      return;
    }
    const list = byGroup.get(attrs.group);
    if (list === undefined) byGroup.set(attrs.group, [node]);
    else list.push(node);
  });
  if (byGroup.size === 0) return;

  let cx = 0;
  let cy = 0;
  let coreRadius = 0;
  if (connected.length > 0) {
    for (const node of connected) {
      cx += graph.getNodeAttribute(node, 'x');
      cy += graph.getNodeAttribute(node, 'y');
    }
    cx /= connected.length;
    cy /= connected.length;
    for (const node of connected) {
      const dx = graph.getNodeAttribute(node, 'x') - cx;
      const dy = graph.getNodeAttribute(node, 'y') - cy;
      coreRadius = Math.max(coreRadius, Math.hypot(dx, dy));
    }
  }

  // Layout units are arbitrary (Sigma rescales to the viewport), so spacing is expressed relative
  // to the connected layout's radius. With no connected nodes, any unit works.
  const spacing = coreRadius > 0 ? coreRadius / 30 : 1;
  const gap = spacing * 2;

  // Pack every group at the origin first to learn its radius; the discs are moved into place
  // afterwards, largest groups first so the inner band holds what draws the eye.
  const satellites: Satellite[] = Array.from(byGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, nodes]) => {
      nodes.sort((a, b) => a.localeCompare(b));
      return { nodes, radius: packDisc(graph, nodes, 0, 0, spacing) };
    });

  let bandRadius = coreRadius * 1.1 + gap;
  let index = 0;
  while (index < satellites.length) {
    // Fill one band: as many discs as fit around the circumference at this distance.
    const band: Satellite[] = [];
    let bandMax = 0;
    let arc = 0;
    while (index < satellites.length) {
      const candidate = satellites[index];
      const distance = bandRadius + candidate.radius;
      const needed = (2 * candidate.radius + gap) / distance;
      if (band.length > 0 && arc + needed > 2 * Math.PI) break;
      band.push(candidate);
      arc += needed;
      bandMax = Math.max(bandMax, candidate.radius);
      index += 1;
    }
    // Spread the band's discs evenly over the full circle.
    const slack = Math.max(0, 2 * Math.PI - arc) / band.length;
    let angle = 0;
    for (const satellite of band) {
      const distance = bandRadius + bandMax;
      const step = (2 * satellite.radius + gap) / distance + slack;
      angle += step / 2;
      const sx = cx + distance * Math.cos(angle);
      const sy = cy + distance * Math.sin(angle);
      for (const node of satellite.nodes) {
        graph.mergeNodeAttributes(node, {
          x: sx + graph.getNodeAttribute(node, 'x'),
          y: sy + graph.getNodeAttribute(node, 'y'),
        });
      }
      angle += step / 2;
    }
    bandRadius += 2 * bandMax + gap;
  }
}

export interface Extent {
  x: [number, number];
  y: [number, number];
}

/**
 * The bounding box Sigma should fit to the viewport. Sigma normalizes positions to the graph's
 * own extent, so a two-token graph would be stretched edge to edge with one node in each corner.
 * Small graphs get a box grown around their center instead — `~sqrt(24 / order)` times larger,
 * so a handful of tokens sits comfortably in the middle while anything past two dozen fills the
 * view as usual.
 */
export function viewerExtent(graph: ViewerGraph): Extent | undefined {
  if (graph.order === 0) return undefined;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  graph.forEachNode((_, attrs) => {
    minX = Math.min(minX, attrs.x);
    maxX = Math.max(maxX, attrs.x);
    minY = Math.min(minY, attrs.y);
    maxY = Math.max(maxY, attrs.y);
  });
  const grow = Math.sqrt(Math.max(1, 24 / graph.order));
  if (grow === 1) return { x: [minX, maxX], y: [minY, maxY] };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = (Math.max(maxX - minX, maxY - minY) / 2 || 1) * grow;
  return { x: [cx - half, cx + half], y: [cy - half, cy + half] };
}

/**
 * Dependency level of every node: 0 for tokens that reference nothing (primitives and isolates),
 * else one more than the deepest token they reference. The graph is acyclic by construction;
 * a visited set still guards the walk.
 */
export function dependencyLevels(graph: ViewerGraph): Map<string, number> {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  const level = (node: string): number => {
    const known = levels.get(node);
    if (known !== undefined) return known;
    if (visiting.has(node)) return 0;
    visiting.add(node);
    let result = 0;
    for (const target of graph.outNeighbors(node)) result = Math.max(result, level(target) + 1);
    visiting.delete(node);
    levels.set(node, result);
    return result;
  };
  graph.forEachNode((node) => level(node));
  return levels;
}

/**
 * A tidy left-to-right layout for small graphs: primitives in the left column, each consumer
 * one column right of the deepest token it references, rows ordered by group then path so
 * related tokens sit together. With a couple dozen tokens this reads like a diagram, where a
 * force layout would just scatter them.
 */
export function layoutLayered(graph: ViewerGraph): void {
  const levels = dependencyLevels(graph);
  const columns = new Map<number, string[]>();
  graph.forEachNode((node) => {
    const l = levels.get(node) ?? 0;
    const column = columns.get(l);
    if (column === undefined) columns.set(l, [node]);
    else column.push(node);
  });
  const columnGap = 1;
  const rowGap = 0.3;
  for (const [l, nodes] of columns) {
    nodes.sort((a, b) => {
      const ga = graph.getNodeAttribute(a, 'group');
      const gb = graph.getNodeAttribute(b, 'group');
      return ga === gb ? a.localeCompare(b) : ga.localeCompare(gb);
    });
    nodes.forEach((node, index) => {
      graph.mergeNodeAttributes(node, {
        x: l * columnGap,
        y: (index - (nodes.length - 1) / 2) * rowGap,
      });
    });
  }
}

/**
 * Compute positions in place. Small graphs get the layered diagram layout. Larger ones get a
 * deterministic circular seed, ForceAtlas2 so tokens that reference each other pull into
 * clusters (the Gephi look), then isolated tokens packed into per-group satellite discs outside.
 * Fully deterministic for a given graph — no randomness anywhere — so the same token set always
 * produces the same map.
 */
export function layoutViewerGraph(graph: ViewerGraph, options: LayoutOptions = {}): void {
  if (graph.order === 0) return;

  if (graph.order <= SMALL_GRAPH_ORDER) {
    layoutLayered(graph);
    return;
  }

  circular.assign(graph, { scale: 1 });

  if (graph.size > 0) {
    forceAtlas2.assign(graph, {
      iterations: options.iterations ?? defaultIterations(graph.order),
      settings: forceAtlas2Settings(graph, options.settings),
    });
  }

  placeIsolatesAsSatellites(graph);
}
