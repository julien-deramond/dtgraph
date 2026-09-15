import { describe, expect, it } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import { collectDownstream, collectFocus, collectUpstream, edgeInFocus } from '../src/focus.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

describe('focus sets', () => {
  const graph = buildViewerGraph(tokenGraphFrom(SAMPLE));

  it('collects transitive sources upstream', () => {
    expect([...collectUpstream(graph, 'button.background')].sort()).toEqual([
      'color.blue',
      'semantic.primary',
    ]);
    expect(collectUpstream(graph, 'color.blue').size).toBe(0);
  });

  it('collects transitive consumers downstream', () => {
    expect([...collectDownstream(graph, 'color.gray')].sort()).toEqual([
      'button.border',
      'button.text',
      'semantic.text',
    ]);
    expect(collectDownstream(graph, 'button.text').size).toBe(0);
  });

  it('combines both directions with the selection itself', () => {
    const focus = collectFocus(graph, 'semantic.primary');
    expect([...focus.all].sort()).toEqual(['button.background', 'color.blue', 'semantic.primary']);
  });

  it('lights only the edges along the focused chains', () => {
    const focus = collectFocus(graph, 'semantic.primary');
    const up = graph.edges('semantic.primary', 'color.blue')[0];
    const down = graph.edges('button.background', 'semantic.primary')[0];
    const unrelated = graph.edges('button.text', 'semantic.text')[0];
    expect(edgeInFocus(graph, up, 'semantic.primary', focus)).toBe(true);
    expect(edgeInFocus(graph, down, 'semantic.primary', focus)).toBe(true);
    expect(edgeInFocus(graph, unrelated, 'semantic.primary', focus)).toBe(false);
  });
});
