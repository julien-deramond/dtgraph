import type { ViewerGraph } from './build-graph.js';
import {
  edgeEmphasis,
  type Emphasis,
  type InteractionState,
  isAnchored,
  LIT_EDGE_THICKNESS,
  nodeEmphasis,
} from './emphasis.js';
import { collectFocus } from './focus.js';
import {
  LABEL_FONT_STACK,
  LABEL_GRID_CELL_SIZE,
  LABEL_SIZE,
  labelFontSize,
  labelOffset,
  selectGridLabels,
} from './labels.js';
import { viewerExtent } from './layout.js';
import { fadeTowards } from './palette.js';
import { THEMES, type ThemeColors, type ViewerTheme } from './theme.js';

/**
 * Escape a string for safe use as SVG/XML text content or a quoted attribute value. Token-derived
 * text (labels, paths) only reaches the returned markup through here — the viewer's canvas never
 * builds markup from token content, and neither may this.
 */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

/** Round to a tenth of a pixel: sub-pixel precision nobody can see, at a third of the bytes. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The CSS color shapes the viewer produces: hex, `rgb()`/`hsl()` (with or without alpha) and
 * bare keywords. No form here can contain a quote, an angle bracket or an ampersand.
 */
const CSS_COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([0-9a-z.,%\s/+-]*\))$/i;

/**
 * Colors land in the markup as raw attribute values, and they are not all ours: `options.theme`
 * takes a whole `ThemeColors` — node palette included — from the caller, so the string that is
 * supposed to be `"#0b0d12"` is only a `string` as far as the type system is concerned. Anything
 * that is not a color the viewer could have produced becomes `currentColor`, so a malformed theme
 * costs a wrong color rather than markup escaping its attribute. Token-derived text takes the
 * other door, {@link escapeXml}; between the two, nothing reaches the output unchecked.
 */
function cssColor(value: string): string {
  return CSS_COLOR.test(value) ? value : 'currentColor';
}

/**
 * Coerce a count read off the graph into a number that is safe to place in the output. `order`
 * and `size` are typed as numbers, but a type is not a runtime check: `graph` is a parameter, and
 * a JavaScript consumer of this package can hand over anything, including something it built from
 * its own untrusted input. These two reach the title text without an escape between them and the
 * reader, so they are coerced rather than trusted, the way `renderTokenGraphToSvg` coerces its
 * width in core.
 */
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export interface ExportSvgOptions {
  /** Theme name, or a full color set. Defaults to `"dark"`, like the viewer. */
  theme?: ViewerTheme | ThemeColors;
  /** Pixel width of the image. The height follows the graph's own proportions. Defaults to 1200. */
  width?: number;
  /** Breathing room around the graph, in pixels. Defaults to the viewer's stage padding (48). */
  padding?: number;
  /**
   * `"auto"` (the default) thins labels through the same grid the canvas uses, `"all"` labels
   * every token (fine for a small graph, a wall of text for a big one), `"none"` labels nothing.
   */
  labels?: 'auto' | 'all' | 'none';
  /** Paint the theme's background behind the graph. Defaults to `true`. */
  background?: boolean;
  /**
   * Draw the map spotlit rather than at rest: the selected token ringed, its chains and the
   * tokens it relates to lit, everything else faded exactly the way the canvas fades it.
   * `viewer.toSvg()` passes the viewer's own state, so an export taken while a token is selected
   * is the picture on screen. Omit it (or pass `undefined`) for the map at rest.
   */
  emphasis?: ExportEmphasis;
}

/**
 * What the export should spotlight. Every field is optional: give a `selected` token and the
 * chains are walked for you, give a `solo` category (and the `categoryOf` that keys it) to show
 * one group alone. A mounted viewer's live interaction state satisfies this as it is.
 */
export interface ExportEmphasis {
  /** The token in the spotlight: it and its transitive relations stay lit. */
  selected?: string | null;
  /** A hovered token, which spotlights its direct neighbors only and outranks `selected`. */
  hovered?: string | null;
  /** A category to show alone, keyed like `categoryOf`; everything else fades. */
  solo?: string | null;
  /** Which category a token belongs to. Defaults to its `group`, like the viewer's default. */
  categoryOf?: (node: string) => string;
  /** Precomputed sets, when the caller already has them (a mounted viewer does). */
  neighborhood?: Set<string>;
  focus?: InteractionState['focus'];
}

/**
 * Fill in whatever the caller left out, so the export asks the same questions the canvas asks.
 * A token this graph does not have is not a selection: it is dropped rather than dimming the
 * whole map around a token that is not on it.
 */
function resolveEmphasis(graph: ViewerGraph, emphasis: ExportEmphasis): InteractionState {
  const known = (key: string | null | undefined): string | null =>
    key !== null && key !== undefined && graph.hasNode(key) ? key : null;
  const hovered = known(emphasis.hovered);
  const selected = known(emphasis.selected);
  return {
    hovered,
    neighborhood:
      emphasis.neighborhood ??
      (hovered === null ? new Set() : new Set([hovered, ...graph.neighbors(hovered)])),
    selected,
    focus: emphasis.focus ?? (selected === null ? null : collectFocus(graph, selected)),
    solo: emphasis.solo ?? null,
    categoryOf: emphasis.categoryOf ?? ((node) => graph.getNodeAttribute(node, 'group')),
  };
}

interface PlacedNode {
  key: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  zIndex: number;
  emphasis: Emphasis;
}

function renderNode(node: PlacedNode, theme: ThemeColors): string {
  const fill =
    node.emphasis === 'dimmed'
      ? fadeTowards(node.color, theme.background, theme.fadedNodeStrength)
      : node.color;
  return (
    `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${round(node.size)}" ` +
    `fill="${cssColor(fill)}"><title>${escapeXml(node.key)}</title></circle>`
  );
}

/** The ring the canvas draws around the token in the spotlight, in the theme's hover color. */
function renderRing(node: PlacedNode, theme: ThemeColors): string {
  return (
    `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${round(node.size + 3)}" ` +
    `fill="none" stroke="${cssColor(theme.hoverRing)}" stroke-width="2" />`
  );
}

function renderLabel(node: PlacedNode, theme: ThemeColors): string {
  const fontSize = labelFontSize(node.size, LABEL_SIZE);
  const { dx, dy } = labelOffset(node.size, fontSize);
  const haloWidth = Math.max(2.5, fontSize / 4);
  // One `<text>` painted stroke-first: the halo keeps the label legible over the edge texture,
  // exactly like the canvas drawer's strokeText/fillText pair.
  return (
    `<text x="${round(node.x + dx)}" y="${round(node.y + dy)}" font-size="${round(fontSize)}" ` +
    `fill="${cssColor(theme.label)}" stroke="${cssColor(theme.labelHalo)}" ` +
    `stroke-width="${round(haloWidth)}" ` +
    `stroke-linejoin="round" paint-order="stroke">${escapeXml(node.label)}</text>`
  );
}

/**
 * One edge: a line from source to target, stopping short of the target dot, plus the arrowhead
 * Sigma's arrow program draws. The head is an explicit triangle rather than a `<marker>`, so the
 * file survives editors and converters that ignore marker color inheritance.
 */
function renderEdge(from: PlacedNode, to: PlacedNode, rawColor: string, thickness: number): string {
  const color = cssColor(rawColor);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return '';
  const ux = dx / distance;
  const uy = dy / distance;

  const headLength = Math.max(6, thickness * 3);
  const headHalf = Math.max(2.5, thickness * 1.6);
  // Where the arrow touches the target dot, and where the line hands over to the head.
  const tipX = to.x - ux * to.size;
  const tipY = to.y - uy * to.size;
  const baseX = tipX - ux * headLength;
  const baseY = tipY - uy * headLength;
  const startX = from.x + ux * from.size;
  const startY = from.y + uy * from.size;
  // A dot pair closer together than the arrowhead is long: draw the head alone, no stub of line.
  const line =
    (baseX - startX) * ux + (baseY - startY) * uy > 0
      ? `<line x1="${round(startX)}" y1="${round(startY)}" x2="${round(baseX)}" y2="${round(baseY)}" ` +
        `stroke="${color}" stroke-width="${round(thickness)}" />`
      : '';
  const points =
    `${round(tipX)},${round(tipY)} ` +
    `${round(baseX - uy * headHalf)},${round(baseY + ux * headHalf)} ` +
    `${round(baseX + uy * headHalf)},${round(baseY - ux * headHalf)}`;
  return `${line}<polygon points="${points}" fill="${color}" />`;
}

/**
 * Render the graph the viewer is showing to a self-contained SVG string: the same ForceAtlas2
 * positions, the same palette colors, the same blast-radius dot sizes and the same faded edge
 * texture, framed the way `fit()` frames it.
 *
 * Pass `options.emphasis` (as `viewer.toSvg()` does) and the file carries the spotlight too: the
 * selected token ringed, its chains lit, everything else faded the way the canvas fades it. The
 * camera and the chrome (search, legend, detail panel) stay out either way, so the file is always
 * the whole map, framed like `fit()`. Pass the graph from a mounted viewer (`viewer.graph`), or
 * build and lay one out yourself with `buildViewerGraph` + `layoutViewerGraph`.
 *
 * Nothing reaches the markup unchecked: token-derived text (labels, paths) is escaped via
 * {@link escapeXml}, colors — which a caller supplies wholesale through `options.theme` — are
 * held to {@link cssColor}, and every dimension is coerced through arithmetic rather than
 * trusted to match its declared type. So this is safe to call with untrusted token files and
 * untrusted options alike, the same guarantee `renderTokenGraphToSvg` makes in core.
 */
export function renderViewerGraphToSvg(graph: ViewerGraph, options: ExportSvgOptions = {}): string {
  const theme = typeof options.theme === 'object' ? options.theme : THEMES[options.theme ?? 'dark'];
  const width = Math.max(1, options.width ?? 1200);
  const padding = Math.max(0, options.padding ?? 48);
  const labels = options.labels ?? 'auto';
  const state = options.emphasis === undefined ? null : resolveEmphasis(graph, options.emphasis);

  const extent = viewerExtent(graph);
  const inner = Math.max(1, width - padding * 2);
  // Sigma normalizes both axes by the larger one, so the map keeps its shape at any zoom; the
  // export does the same and then sizes the image to the content instead of to a fixed stage.
  const spanX = extent === undefined ? 0 : extent.x[1] - extent.x[0];
  const spanY = extent === undefined ? 0 : extent.y[1] - extent.y[0];
  const span = Math.max(spanX, spanY) || 1;
  const scale = inner / span;
  const height = Math.max(1, Math.round(spanY * scale + padding * 2));
  const offsetX = padding + (inner - spanX * scale) / 2;
  const offsetY = padding;

  const nodes: PlacedNode[] = [];
  graph.forEachNode((key, attrs) => {
    nodes.push({
      key,
      label: attrs.label,
      x: offsetX + (attrs.x - (extent?.x[0] ?? 0)) * scale,
      // Sigma reads y as cartesian (up is positive) while SVG reads it as screen pixels (down is
      // positive), so the axis is flipped here. Without it the export is the map upside down.
      y: offsetY + ((extent?.y[1] ?? 0) - attrs.y) * scale,
      size: attrs.size,
      color: attrs.color,
      zIndex: attrs.zIndex,
      emphasis: state === null ? 'normal' : nodeEmphasis(state, key),
    });
  });
  const byKey = new Map(nodes.map((node) => [node.key, node]));

  // Three passes so a lit chain lands on top of the texture it runs through, the way Sigma's
  // z-index puts it there: dimmed edges first, edges at rest next, the spotlight last.
  const edgeMarkup: Record<Emphasis, string[]> = { dimmed: [], normal: [], lit: [] };
  graph.forEachEdge((edge, attrs, source, target) => {
    const from = byKey.get(source);
    const to = byKey.get(target);
    if (from === undefined || to === undefined) return;
    const emphasis = state === null ? 'normal' : edgeEmphasis(graph, state, edge);
    // A lit edge keeps its own color at a thickness that reads as a line; everything else fades
    // into the background, hard for what the spotlight excludes and gently for a map at rest.
    const color =
      emphasis === 'lit'
        ? attrs.color
        : fadeTowards(
            attrs.color,
            theme.background,
            emphasis === 'dimmed' ? theme.fadedEdgeStrength : theme.edgeStrength,
          );
    const thickness = emphasis === 'lit' ? LIT_EDGE_THICKNESS : Math.max(0.6, attrs.size);
    edgeMarkup[emphasis].push(renderEdge(from, to, color, thickness));
  });

  // Lit dots last, like the reducer's z-index lift; within a band, by z-index then size.
  const painted = [...nodes].sort(
    (a, b) =>
      Number(a.emphasis === 'lit') - Number(b.emphasis === 'lit') ||
      a.zIndex - b.zIndex ||
      a.size - b.size,
  );

  // A dimmed dot loses its label on the canvas, so it neither gets one here nor competes for a
  // grid cell — which is what leaves room for the chain in the spotlight to be readable. The
  // spotlit token and its direct neighbors are labelled whatever the grid says, as on screen.
  const labellable = painted.filter((node) => node.emphasis !== 'dimmed' && node.label !== '');
  const labelled =
    labels === 'none'
      ? new Set<string>()
      : labels === 'all'
        ? new Set(labellable.map((node) => node.key))
        : new Set([
            ...selectGridLabels(labellable, LABEL_GRID_CELL_SIZE),
            ...(state === null
              ? []
              : labellable
                  .filter((node) => isAnchored(graph, state, node.key))
                  .map((node) => node.key)),
          ]);

  // The ring Sigma paints around the token the spotlight is about (the hovered one, or the
  // selection when the pointer is elsewhere), unless a solo'd legend category has dimmed it.
  const ringed = painted.filter(
    (node) => node.emphasis !== 'dimmed' && node.key === (state?.hovered ?? state?.selected),
  );

  const background =
    (options.background ?? true)
      ? `<rect width="${width}" height="${height}" fill="${cssColor(theme.background)}" />`
      : '';
  // The selection is the subject of a spotlit export, so say so where a screen reader will read
  // it: the alternative is an image announced as a graph of 950 tokens with no hint of the one.
  const focused =
    state?.selected === null || state?.selected === undefined
      ? ''
      : `, focused on ${escapeXml(state.selected)}`;
  const tokens = count(graph.order);
  const references = count(graph.size);
  const title =
    `<title>Token graph: ${tokens} token${tokens === 1 ? '' : 's'}, ` +
    `${references} reference${references === 1 ? '' : 's'}${focused}</title>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" role="img" ` +
    `font-family="${escapeXml(LABEL_FONT_STACK)}" font-weight="500">` +
    title +
    background +
    `<g class="dtgraph-edges">` +
    [...edgeMarkup.dimmed, ...edgeMarkup.normal, ...edgeMarkup.lit].join('') +
    '</g>' +
    `<g class="dtgraph-nodes">${painted.map((node) => renderNode(node, theme)).join('')}</g>` +
    (ringed.length === 0
      ? ''
      : `<g class="dtgraph-selection">${ringed.map((node) => renderRing(node, theme)).join('')}</g>`) +
    `<g class="dtgraph-labels">` +
    labellable
      .filter((node) => labelled.has(node.key))
      .map((node) => renderLabel(node, theme))
      .join('') +
    '</g>' +
    '</svg>'
  );
}
