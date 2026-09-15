import css from './style.css?raw';

const STYLE_ID = 'dtgraph-viewer-styles';

/**
 * The viewer's stylesheet as a string — the same content as `@dtgraph/viewer/style.css`, for
 * hosts that cannot import CSS files (Storybook's manager, a plain `<script>` tag, ...).
 */
export const VIEWER_CSS: string = css;

/**
 * Add the viewer's stylesheet to a document once. Safe to call repeatedly: subsequent calls are
 * no-ops while the injected `<style>` element is still present.
 */
export function injectViewerStyles(target: Document = document): HTMLStyleElement {
  const existing = target.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = target.createElement('style');
  style.id = STYLE_ID;
  style.textContent = VIEWER_CSS;
  target.head.appendChild(style);
  return style;
}
