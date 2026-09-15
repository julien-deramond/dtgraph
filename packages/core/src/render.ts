import type { TokenEdge, TokenGraph, TokenNode } from './types.js';

const ROW_HEIGHT = 32;
const MARGIN_Y = 24;
const NODE_X = 16;
const LABEL_X = 28;
const EDGE_CURVE_X = 320;
const EDGE_LABEL_X = EDGE_CURVE_X - 24;

const ALIAS_STROKE = '#2563eb';
const COMPOSITE_STROKE = '#9333ea';

/**
 * Escape a string for safe use as SVG/XML text content (or a quoted attribute value). This is
 * the only path token-derived text (paths, descriptions, alias references, member names) may
 * reach the returned markup through — never raw string concatenation.
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

function pathKey(path: string[]): string {
  return path.join('.');
}

function renderNode(node: TokenNode, y: number): string {
  const label = escapeXml(pathKey(node.path));
  const title =
    node.description !== undefined ? `<title>${escapeXml(node.description)}</title>` : '';
  return (
    `<g class="dtgraph-node" transform="translate(${NODE_X}, ${y})">` +
    title +
    '<circle r="4" fill="currentColor" />' +
    `<text x="${LABEL_X - NODE_X}" y="4" fill="currentColor">${label}</text>` +
    '</g>'
  );
}

function renderEdge(edge: TokenEdge, yByPath: Map<string, number>): string | undefined {
  const fromY = yByPath.get(pathKey(edge.from));
  const toY = yByPath.get(pathKey(edge.to));
  if (fromY === undefined || toY === undefined) return undefined;

  const isComposite = edge.kind === 'composite-member';
  const stroke = isComposite ? COMPOSITE_STROKE : ALIAS_STROKE;
  const dashArray = isComposite ? ' stroke-dasharray="4 3"' : '';
  const label = escapeXml(
    edge.member !== undefined ? `${edge.reference} (${edge.member})` : edge.reference,
  );
  const midY = (fromY + toY) / 2;

  return (
    `<g class="dtgraph-edge ${isComposite ? 'composite-member' : 'alias'}">` +
    `<path d="M ${LABEL_X} ${fromY} C ${EDGE_CURVE_X} ${fromY}, ${EDGE_CURVE_X} ${toY}, ${LABEL_X} ${toY}" ` +
    `fill="none" stroke="${stroke}"${dashArray} />` +
    `<text x="${EDGE_LABEL_X}" y="${midY}" text-anchor="end" fill="currentColor">${label}</text>` +
    '</g>'
  );
}

export interface RenderTokenGraphOptions {
  /** Pixel width of the returned SVG's `viewBox`/`width`. Defaults to `480`. */
  width?: number;
}

/**
 * Render a `TokenGraph` to a self-contained SVG string: one row per node, with alias and
 * composite-member edges drawn as curves distinguished by color/dash style and labeled with
 * their reference.
 *
 * Every piece of token-derived text (paths, descriptions, alias references, member names) is
 * escaped via {@link escapeXml} before being placed in the output — never concatenated or
 * assigned via `innerHTML` — so this is safe to call with untrusted token content (e.g. the
 * website playground's user-uploaded JSON). Returns a plain string, so it works identically in
 * a browser and in Node (e.g. the CLI writing an `.svg` file) without touching the DOM.
 */
export function renderTokenGraphToSvg(
  graph: TokenGraph,
  options: RenderTokenGraphOptions = {},
): string {
  const width = options.width ?? 480;
  const rowCount = graph.nodes.length;
  const height = rowCount === 0 ? MARGIN_Y * 2 : MARGIN_Y * 2 + (rowCount - 1) * ROW_HEIGHT;

  const yByPath = new Map<string, number>();
  graph.nodes.forEach((node, index) => {
    yByPath.set(pathKey(node.path), MARGIN_Y + index * ROW_HEIGHT);
  });

  const edgeMarkup = graph.edges
    .map((edge) => renderEdge(edge, yByPath))
    .filter((markup): markup is string => markup !== undefined)
    .join('');
  const nodeMarkup = graph.nodes
    .map((node) => renderNode(node, yByPath.get(pathKey(node.path)) ?? MARGIN_Y))
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" font-family="sans-serif" font-size="11">` +
    `<g class="dtgraph-edges">${edgeMarkup}</g>` +
    `<g class="dtgraph-nodes">${nodeMarkup}</g>` +
    '</svg>'
  );
}
