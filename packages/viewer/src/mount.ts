import type { TokenGraph } from '@dtgraph/core';
import Sigma from 'sigma';

import {
  buildViewerGraph,
  type ColorBy,
  type ViewerEdgeAttributes,
  type ViewerGraph,
  type ViewerNodeAttributes,
} from './build-graph.js';
import { layoutViewerGraph, viewerExtent, type LayoutOptions } from './layout.js';
import { createInteractionState, createSigmaSettings } from './render.js';
import { THEMES, type ViewerTheme } from './theme.js';

export interface TokenGraphViewerOptions {
  /** Defaults to `"dark"`. */
  theme?: ViewerTheme;
  /** Defaults to `"group"`. */
  colorBy?: ColorBy;
  layout?: LayoutOptions;
}

/** The Sigma instance type the viewer creates, typed with the viewer's node/edge attributes. */
export type ViewerSigma = Sigma<ViewerNodeAttributes, ViewerEdgeAttributes>;

export interface TokenGraphViewer {
  /** The underlying Sigma renderer — an escape hatch for extensions; prefer the methods here. */
  readonly sigma: ViewerSigma;
  /** The laid-out graphology graph Sigma is rendering. */
  readonly graph: ViewerGraph;
  /** Animate the camera back to the whole graph. */
  fit(): void;
  /** Animate the camera onto one token (by dotted path or path segments). No-op if unknown. */
  zoomTo(path: string | string[]): void;
  /** Tear down the renderer and remove everything the viewer added to the container. */
  destroy(): void;
}

const CONTAINER_CLASS = 'dtgraph-viewer';
const STAGE_CLASS = 'dtgraph-viewer__stage';

/**
 * Mount an interactive map of `tokenGraph` into `container` (which must have a non-zero size —
 * give it a height). Pan by dragging, zoom with the wheel or pinch, double-click a token to dive
 * onto it, hover a token to spotlight what it references and what references it.
 *
 * Token-derived text only ever reaches the screen through canvas `fillText` (labels) — nothing
 * here builds HTML from token content, so this is safe for untrusted token files just like
 * `renderTokenGraphToSvg`.
 */
export function mountTokenGraphViewer(
  container: HTMLElement,
  tokenGraph: TokenGraph,
  options: TokenGraphViewerOptions = {},
): TokenGraphViewer {
  const themeName = options.theme ?? 'dark';
  const theme = THEMES[themeName];

  const graph = buildViewerGraph(tokenGraph, {
    colorBy: options.colorBy,
    palette: theme.palette,
  });
  layoutViewerGraph(graph, options.layout);

  container.classList.add(CONTAINER_CLASS);
  container.dataset.theme = themeName;
  const stage = document.createElement('div');
  stage.className = STAGE_CLASS;
  container.appendChild(stage);

  const state = createInteractionState();
  let sigma: ViewerSigma;
  try {
    sigma = new Sigma(graph, stage, createSigmaSettings(graph, theme, state));
  } catch (error) {
    container.removeChild(stage);
    container.classList.remove(CONTAINER_CLASS);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `@dtgraph/viewer could not start the WebGL renderer (${reason}). ` +
        'The container needs a non-zero width and height, and the browser needs WebGL.',
      { cause: error },
    );
  }

  const extent = viewerExtent(graph);
  if (extent !== undefined) sigma.setCustomBBox(extent);

  sigma.on('enterNode', ({ node }) => {
    state.hovered = node;
    state.neighborhood = new Set([node, ...graph.neighbors(node)]);
    sigma.refresh({ skipIndexation: true });
  });
  sigma.on('leaveNode', () => {
    state.hovered = null;
    state.neighborhood = new Set();
    sigma.refresh({ skipIndexation: true });
  });

  const zoomTo = (path: string | string[]): void => {
    const key = Array.isArray(path) ? path.join('.') : path;
    const display = sigma.getNodeDisplayData(key);
    if (display === undefined) return;
    const camera = sigma.getCamera();
    void camera.animate(
      { x: display.x, y: display.y, ratio: Math.min(camera.getState().ratio, 0.12) },
      { duration: 450 },
    );
  };
  sigma.on('doubleClickNode', ({ node, event }) => {
    event.preventSigmaDefault();
    zoomTo(node);
  });

  // Sigma only watches window resizes; follow the container too (panels, split panes, a banner
  // appearing above the map, ...). `scheduleRefresh` is what Sigma's own window handler calls:
  // a bare `resize()` re-sizes (and thereby clears) the canvases without redrawing them.
  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => sigma.scheduleRefresh());
    observer.observe(container);
  }

  return {
    sigma,
    graph,
    fit: () => {
      void sigma.getCamera().animatedReset({ duration: 350 });
    },
    zoomTo,
    destroy: () => {
      observer?.disconnect();
      sigma.kill();
      if (stage.parentNode === container) container.removeChild(stage);
      container.classList.remove(CONTAINER_CLASS);
      delete container.dataset.theme;
    },
  };
}
