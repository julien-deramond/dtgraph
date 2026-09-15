import { circular } from 'graphology-layout';
import forceAtlas2, { type ForceAtlas2Settings } from 'graphology-layout-forceatlas2';

import type { ViewerGraph } from './build-graph.js';

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

/**
 * Compute positions in place: a deterministic circular seed, ForceAtlas2 so tokens that reference
 * each other pull into clusters (the Gephi look), then isolated tokens packed into per-group satellite discs outside.
 * Fully deterministic for a given graph — no randomness anywhere — so the same token set always
 * produces the same map.
 */
export function layoutViewerGraph(graph: ViewerGraph, options: LayoutOptions = {}): void {
  if (graph.order === 0) return;

  circular.assign(graph, { scale: 1 });

  if (graph.size > 0) {
    forceAtlas2.assign(graph, {
      iterations: options.iterations ?? defaultIterations(graph.order),
      settings: forceAtlas2Settings(graph, options.settings),
    });
  }

  placeIsolatesAsSatellites(graph);
}
