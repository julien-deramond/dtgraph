import React, { useEffect, useMemo, useRef } from 'react';
import { useParameter } from 'storybook/manager-api';
import { useTheme } from 'storybook/theming';

import type { TokenGraph } from '@dtgraph/core';
import { injectViewerStyles, mountTokenGraphViewer } from '@dtgraph/viewer';
import type { ThemeColors, TokenGraphViewer, ViewerTheme } from '@dtgraph/viewer';

import { PARAM_KEY } from './constants.js';
import { buildStoryTokenGraph, type DtgraphParameter } from './render-story-graph.js';

type GraphResult = { ok: true; graph: TokenGraph } | { ok: false; message: string | undefined };

/**
 * Mount the interactive viewer into `container` as soon as it has a size, and tear it down on
 * cleanup. Storybook keeps inactive panels in the DOM with no size, and the WebGL renderer
 * refuses a zero-sized container, so mounting waits for the pane to actually be shown.
 */
function useTokenGraphViewer(
  container: React.RefObject<HTMLDivElement | null>,
  graph: TokenGraph | undefined,
  theme: ViewerTheme | ThemeColors,
): void {
  useEffect(() => {
    const element = container.current;
    if (element === null || graph === undefined) return undefined;
    injectViewerStyles(element.ownerDocument);

    let viewer: TokenGraphViewer | undefined;
    const mountIfSized = (): void => {
      if (viewer !== undefined || element.clientWidth === 0 || element.clientHeight === 0) return;
      viewer = mountTokenGraphViewer(element, graph, { theme });
    };
    mountIfSized();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(mountIfSized);
    observer?.observe(element);

    return () => {
      observer?.disconnect();
      viewer?.destroy();
    };
  }, [container, graph, theme]);
}

/**
 * The token graph panel: reads the active story's `dtgraph` parameter and renders it with
 * `@dtgraph/viewer`. Re-renders automatically when the active story changes, since
 * `useParameter` subscribes to Storybook's manager state; follows the manager's light/dark theme
 * unless the parameter sets its own.
 */
export function Panel(): React.ReactElement {
  const parameter = useParameter<DtgraphParameter | undefined>(PARAM_KEY, undefined);
  // Storybook's converted theme carries `base: 'light' | 'dark'` (typed loosely here to avoid
  // depending on the theming package's type surface).
  const managerTheme: ViewerTheme =
    (useTheme() as { base?: string }).base === 'light' ? 'light' : 'dark';
  const theme = parameter?.theme ?? managerTheme;
  const container = useRef<HTMLDivElement>(null);

  const result = useMemo<GraphResult>(() => {
    if (parameter?.tokens === undefined) return { ok: false, message: undefined };
    try {
      return { ok: true, graph: buildStoryTokenGraph(parameter.tokens) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, [parameter]);

  useTokenGraphViewer(container, result.ok ? result.graph : undefined, theme);

  if (parameter?.tokens === undefined) {
    return (
      <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
        <p>
          No token graph for this story. Add a <code>dtgraph</code> parameter with a{' '}
          <code>tokens</code> field:
        </p>
        <pre>{`parameters: {\n  dtgraph: { tokens: { color: { brand: { $value: '#3311ff' } } } },\n}`}</pre>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div style={{ padding: '1rem', fontFamily: 'sans-serif', color: '#b91c1c' }}>
        {result.message}
      </div>
    );
  }

  // The viewer draws token text on a canvas and builds its panels with textContent — nothing
  // from the tokens becomes markup, the same trust model as the playground and <TokenGraph>.
  return <div ref={container} style={{ position: 'absolute', inset: 0 }} />;
}
