/**
 * The brand colors the Token Graph panel needs, read from @deramond.dev/tokens, and the style
 * that themes its search box, legend and detail panel (added to the manager's head in
 * `main.ts`, mirroring `apps/website/src/styles/viewer.css`). No `@dtgraph/viewer` import here:
 * `main.ts` runs in Node, and the viewer's renderer needs a browser.
 */
import { resolver } from '@deramond.dev/tokens';

const tokens = resolver.apply({});

export function hex(name: string): string {
  const token = tokens[`color.${name}`];
  const value = token?.$type === 'color' ? token.$value.hex : undefined;
  if (value === undefined)
    throw new Error(`dtgraph theme: "color.${name}" is not a hex color token`);
  return value;
}

export function rgba(name: string, alpha?: number): string {
  const token = tokens[`color.${name}`];
  if (token?.$type !== 'color')
    throw new Error(`dtgraph theme: "color.${name}" is not a color token`);
  const channels = token.$value.components.map((c) => Math.round(Number(c) * 255));
  return `rgba(${channels.join(', ')}, ${alpha ?? token.$value.alpha ?? 1})`;
}

const body = tokens['font.family.body'];
const font =
  body?.$type === 'fontFamily'
    ? body.$value.map((family) => (/\s/.test(family) ? `"${family}"` : family)).join(', ')
    : 'sans-serif';

// `[data-theme]` for specificity: the viewer injects its defaults on `.dtgraph-viewer` into the
// manager, possibly after this style.
export const viewerChromeCss = `.dtgraph-viewer[data-theme] {
  --dtgraph-viewer-bg: ${hex('bg')};
  --dtgraph-viewer-fg: ${hex('fg')};
  --dtgraph-viewer-font: ${font};
  --dtgraph-viewer-panel-bg: ${rgba('panel', 0.92)};
  --dtgraph-viewer-panel-fg: ${hex('fg')};
  --dtgraph-viewer-panel-muted: ${hex('muted')};
  --dtgraph-viewer-panel-line: ${hex('line')};
  --dtgraph-viewer-panel-hover: ${rgba('tint')};
  --dtgraph-viewer-accent: ${hex('primary')};
  --dtgraph-viewer-code-bg: ${hex('bg')};
  --dtgraph-viewer-shadow: none;
}`;
