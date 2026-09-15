import React, { useMemo } from 'react';
import { useParameter } from 'storybook/manager-api';

import { PARAM_KEY } from './constants.js';
import { renderStoryTokensToSvg, type DtgraphParameter } from './render-story-graph.js';

/**
 * The token graph panel: reads the active story's `dtgraph` parameter and renders the
 * resulting SVG. Re-renders automatically when the active story changes, since `useParameter`
 * subscribes to Storybook's manager state.
 */
export function Panel(): React.ReactElement {
  const parameter = useParameter<DtgraphParameter | undefined>(PARAM_KEY, undefined);

  const result = useMemo(() => {
    if (parameter?.tokens === undefined) return { ok: false as const, message: undefined };
    try {
      return { ok: true as const, svg: renderStoryTokensToSvg(parameter.tokens) };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [parameter]);

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

  // Safe: renderTokenGraphToSvg (via renderStoryTokensToSvg) escapes every piece of
  // token-derived text before returning, the same trust model as the website playground and
  // <TokenGraph>'s use of set:html.
  return <div style={{ padding: '1rem' }} dangerouslySetInnerHTML={{ __html: result.svg }} />;
}
