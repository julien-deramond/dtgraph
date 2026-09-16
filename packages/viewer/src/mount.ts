import type { TokenGraph } from '@dtgraph/core';
import Sigma from 'sigma';

import type { TokenNode } from '@dtgraph/core';

import {
  buildViewerGraph,
  type ColorBy,
  type ViewerEdgeAttributes,
  type ViewerGraph,
  type ViewerNodeAttributes,
} from './build-graph.js';
import {
  COMPACT_WIDTH,
  hasCoarsePointer,
  isFullBleed,
  motionDuration,
  stagePaddingFor,
} from './environment.js';
import { collectFocus } from './focus.js';
import { layoutViewerGraph, viewerExtent, type LayoutOptions } from './layout.js';
import { createInteractionState, createSigmaSettings } from './render.js';
import { searchTokens } from './search.js';
import { THEMES, type ViewerTheme } from './theme.js';
import { el } from './ui/dom.js';
import { createActivationGate } from './ui/gate.js';
import { createLegend, type LegendEntry } from './ui/legend.js';
import { createDetailPanel } from './ui/panel.js';
import { createSearchBox } from './ui/search.js';

export interface TokenGraphViewerOptions {
  /** Defaults to `"dark"`. */
  theme?: ViewerTheme;
  /** Defaults to `"group"`. */
  colorBy?: ColorBy;
  layout?: LayoutOptions;
  /** Hide the built-in search box, legend and detail panel (keep just the map). */
  chrome?: boolean;
  /** Called whenever the selection changes (`undefined` when cleared). */
  onSelect?: (token: TokenNode | undefined) => void;
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
  /** Select a token: spotlight its upstream/downstream chains and open its details. */
  select(path: string | string[]): void;
  clearSelection(): void;
  /** The selected token's dotted path, if any. */
  readonly selected: string | undefined;
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

  const chrome = options.chrome ?? true;
  const colorBy = options.colorBy ?? 'group';
  const categoryOf = (node: string): string =>
    colorBy === 'type'
      ? graph.getNodeAttribute(node, 'tokenType')
      : graph.getNodeAttribute(node, 'group');
  const state = createInteractionState(categoryOf);
  // Read once: these settle what Sigma is constructed with. Everything that can change while the
  // viewer is alive (its size, whether it owns the screen) is re-read in `syncEnvironment`.
  const coarsePointer = hasCoarsePointer();
  let stagePadding = stagePaddingFor(container.clientWidth);
  let sigma: ViewerSigma;
  try {
    sigma = new Sigma(
      graph,
      stage,
      createSigmaSettings(graph, theme, state, { coarsePointer, stagePadding }),
    );
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

  const refresh = (): void => {
    sigma.refresh({ skipIndexation: true });
  };

  // --- Chrome: search, legend, detail panel --------------------------------------------------
  const ui = el('div', 'dtgraph-viewer__ui');
  const toKey = (path: string | string[]): string => (Array.isArray(path) ? path.join('.') : path);

  /**
   * How far off center a token should land, in pixels, so the chrome is not sitting on top of it.
   * On a wide container the details are a side rail the map is already narrower than; on a narrow
   * one they come up as a sheet, and the token belongs in the middle of what is left above it.
   */
  const focalOffset = (): { x: number; y: number } => {
    if (panel.element.hidden) return { x: 0, y: 0 };
    const view = container.getBoundingClientRect();
    const sheet = panel.element.getBoundingClientRect();
    if (view.width === 0 || sheet.width < view.width * 0.7) return { x: 0, y: 0 };
    return { x: 0, y: -Math.max(0, view.bottom - sheet.top) / 2 };
  };

  /** The same offset in the coordinate space the camera moves in, at the ratio it will end at. */
  const framedShift = (
    offset: { x: number; y: number },
    ratio: number,
  ): { x: number; y: number } => {
    const override = { cameraState: { ...sigma.getCamera().getState(), ratio } };
    const origin = sigma.viewportToFramedGraph({ x: 0, y: 0 }, override);
    const moved = sigma.viewportToFramedGraph(offset, override);
    return { x: moved.x - origin.x, y: moved.y - origin.y };
  };

  const zoomTo = (path: string | string[], ratio = 0.12): void => {
    const display = sigma.getNodeDisplayData(toKey(path));
    if (display === undefined) return;
    const camera = sigma.getCamera();
    const target = Math.min(camera.getState().ratio, ratio);
    const offset = focalOffset();
    const shift = offset.y === 0 ? offset : framedShift(offset, target);
    void camera.animate(
      { x: display.x - shift.x, y: display.y - shift.y, ratio: target },
      { duration: motionDuration(450) },
    );
  };

  const panel = createDetailPanel({
    graph,
    tokenGraph,
    onNavigate: (key) => {
      select(key);
      zoomTo(key, 0.4);
    },
    onClose: () => clearSelection(),
  });

  const select = (path: string | string[]): void => {
    const key = toKey(path);
    if (!graph.hasNode(key)) return;
    state.selected = key;
    state.focus = collectFocus(graph, key);
    panel.show(key);
    refresh();
    options.onSelect?.(graph.getNodeAttribute(key, 'token'));
  };

  const clearSelection = (): void => {
    if (state.selected === null) return;
    state.selected = null;
    state.focus = null;
    panel.hide();
    refresh();
    options.onSelect?.(undefined);
  };

  const search = createSearchBox({
    search: (query) => searchTokens(graph, query),
    rowFor: (key) => {
      const attrs = graph.getNodeAttributes(key);
      return { key, color: attrs.color, tokenType: attrs.tokenType };
    },
    onPick: (key) => {
      select(key);
      zoomTo(key, 0.4);
    },
  });

  const legendEntries = new Map<string, LegendEntry>();
  graph.forEachNode((node, attrs) => {
    const key = categoryOf(node);
    const entry = legendEntries.get(key);
    if (entry !== undefined) entry.count += 1;
    else
      legendEntries.set(key, {
        key,
        label: key === '' ? '(root)' : key,
        color: attrs.color,
        count: 1,
      });
  });
  const compactAtMount = container.clientWidth > 0 && container.clientWidth <= COMPACT_WIDTH;
  const legend = createLegend({
    title: colorBy === 'type' ? 'Types' : 'Groups',
    entries: [...legendEntries.values()].sort(
      (a, b) => b.count - a.count || a.key.localeCompare(b.key),
    ),
    open: compactAtMount ? false : undefined,
    onSolo: (key) => {
      state.solo = key;
      refresh();
    },
  });

  // --- Who owns a touch gesture: the page, or the map ---------------------------------------
  // The veil sits under the chrome in paint order, so a passive viewer still searches and reads.
  let held = false;
  const gate = createActivationGate({
    onChange: (next) => {
      held = next;
      syncEnvironment();
    },
  });

  ui.appendChild(gate.veil);
  if (chrome) ui.append(search.element, legend.element, panel.element);
  ui.appendChild(gate.release);
  // Without chrome the host draws its own UI, but the gesture bargain is not chrome: a map that
  // eats a finger inside someone else's article is broken either way.
  if (chrome || coarsePointer) container.appendChild(ui);

  /**
   * Re-read what the box is and tell CSS: whether it covers the screen (and may reach into the
   * safe areas), and who a finger landing on it belongs to. A viewer that owns the screen has no
   * page to scroll, so it never asks; anything smaller starts passive until the visitor taps.
   */
  const syncEnvironment = (): void => {
    const fullBleed = isFullBleed(container);
    container.dataset.fullBleed = String(fullBleed);
    const gated = coarsePointer && !fullBleed;
    if (!gated) held = false;
    container.dataset.gesture = !gated ? 'map' : held ? 'held' : 'page';

    const padding = stagePaddingFor(container.clientWidth);
    if (padding !== stagePadding) {
      stagePadding = padding;
      sigma.setSetting('stagePadding', padding);
    }
  };
  syncEnvironment();

  // --- Pointer interaction ------------------------------------------------------------------
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

  sigma.on('clickNode', ({ node }) => select(node));
  sigma.on('clickStage', () => clearSelection());
  sigma.on('doubleClickNode', ({ node, event }) => {
    event.preventSigmaDefault();
    select(node);
    zoomTo(node);
  });

  // --- Keyboard: `/` or Ctrl/Cmd+K to search, Esc to clear, `f` to fit ----------------------
  const isTyping = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  const onKeydown = (event: KeyboardEvent): void => {
    if (!chrome) return;
    const inside =
      container.contains(document.activeElement) ||
      document.activeElement === null ||
      document.activeElement === document.body;
    if (!inside) return;
    if (event.key === 'Escape') {
      search.clear();
      clearSelection();
      return;
    }
    if (isTyping(event.target)) return;
    if (
      event.key === '/' ||
      ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')
    ) {
      event.preventDefault();
      search.focus();
    } else if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
      void sigma.getCamera().animatedReset({ duration: motionDuration(350) });
    }
  };
  document.addEventListener('keydown', onKeydown);

  // Sigma only watches window resizes; follow the container too (panels, split panes, a banner
  // appearing above the map, ...). `scheduleRefresh` is what Sigma's own window handler calls:
  // a bare `resize()` re-sizes (and thereby clears) the canvases without redrawing them.
  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      syncEnvironment();
      sigma.scheduleRefresh();
    });
    observer.observe(container);
  }

  // A map still holding the visitor's finger after they have scrolled past it is a trap: give
  // the gestures back on its way off screen, while the page can still be scrolled to do it.
  let visibility: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== 'undefined') {
    visibility = new IntersectionObserver(
      ([entry]) => {
        if (held && entry !== undefined && !entry.isIntersecting) {
          held = false;
          syncEnvironment();
        }
      },
      { threshold: 0.25 },
    );
    visibility.observe(container);
  }

  return {
    sigma,
    graph,
    fit: () => {
      void sigma.getCamera().animatedReset({ duration: motionDuration(350) });
    },
    zoomTo: (path) => zoomTo(path),
    select,
    clearSelection,
    get selected() {
      return state.selected ?? undefined;
    },
    destroy: () => {
      document.removeEventListener('keydown', onKeydown);
      observer?.disconnect();
      visibility?.disconnect();
      gate.destroy();
      search.destroy();
      legend.destroy();
      panel.destroy();
      ui.remove();
      sigma.kill();
      if (stage.parentNode === container) container.removeChild(stage);
      container.classList.remove(CONTAINER_CLASS);
      delete container.dataset.theme;
      delete container.dataset.fullBleed;
      delete container.dataset.gesture;
    },
  };
}
