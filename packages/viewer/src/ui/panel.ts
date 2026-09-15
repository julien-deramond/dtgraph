import type { TokenGraph } from '@dtgraph/core';

import type { ViewerGraph } from '../build-graph.js';
import { resolveValue, swatchColor } from '../resolve-value.js';
import { button, dot, el, pathLabel } from './dom.js';

export interface DetailPanelOptions {
  graph: ViewerGraph;
  tokenGraph: TokenGraph;
  /** Called when a related token is clicked in the panel. */
  onNavigate(key: string): void;
  onClose(): void;
}

export interface DetailPanel {
  element: HTMLElement;
  show(key: string): void;
  hide(): void;
  destroy(): void;
}

function pretty(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * The selected token's card: identity, type/group/source, description, raw and resolved value
 * (with a swatch for colors), and clickable lists of what it depends on and what uses it. Built
 * entirely from DOM nodes and `textContent`.
 */
export function createDetailPanel(options: DetailPanelOptions): DetailPanel {
  const element = el('aside', 'dtgraph-viewer__panel');
  element.setAttribute('aria-label', 'Token details');
  element.hidden = true;

  const section = (title: string): HTMLElement => {
    const wrapper = el('section', 'dtgraph-viewer__section');
    wrapper.appendChild(el('h3', 'dtgraph-viewer__section-title', title));
    return wrapper;
  };

  const relationList = (
    title: string,
    items: { key: string; note?: string }[],
    extra?: string,
  ): HTMLElement | undefined => {
    if (items.length === 0 && extra === undefined) return undefined;
    const wrapper = section(`${title} (${items.length})`);
    const list = el('ul', 'dtgraph-viewer__relations');
    for (const item of items) {
      const li = el('li');
      const link = button('dtgraph-viewer__relation', '', () => options.onNavigate(item.key));
      link.append(dot(options.graph.getNodeAttribute(item.key, 'color')), pathLabel(item.key));
      if (item.note !== undefined) link.appendChild(el('span', 'dtgraph-viewer__chip', item.note));
      li.appendChild(link);
      list.appendChild(li);
    }
    wrapper.appendChild(list);
    if (extra !== undefined) wrapper.appendChild(el('p', 'dtgraph-viewer__muted', extra));
    return wrapper;
  };

  const show = (key: string): void => {
    if (!options.graph.hasNode(key)) return;
    const attrs = options.graph.getNodeAttributes(key);
    const token = attrs.token;
    element.replaceChildren();

    const header = el('header', 'dtgraph-viewer__panel-header');
    const title = el('h2', 'dtgraph-viewer__panel-title');
    title.append(dot(attrs.color), pathLabel(key));
    const close = button('dtgraph-viewer__close', '×', options.onClose);
    close.setAttribute('aria-label', 'Close details');
    header.append(title, close);
    element.appendChild(header);

    const chips = el('div', 'dtgraph-viewer__chips');
    chips.appendChild(el('span', 'dtgraph-viewer__chip', attrs.tokenType));
    if (attrs.group !== '') chips.appendChild(el('span', 'dtgraph-viewer__chip', attrs.group));
    if (token.source !== undefined)
      chips.appendChild(el('span', 'dtgraph-viewer__chip', token.source));
    element.appendChild(chips);

    if (token.description !== undefined) {
      element.appendChild(el('p', 'dtgraph-viewer__description', token.description));
    }

    const valueSection = section('Value');
    const resolved = resolveValue(options.tokenGraph, token.path);
    const swatch = swatchColor(attrs.tokenType, resolved.value);
    if (swatch !== undefined) {
      const preview = el('div', 'dtgraph-viewer__swatch');
      preview.style.background = swatch;
      preview.title = swatch;
      valueSection.appendChild(preview);
    }
    valueSection.appendChild(el('pre', 'dtgraph-viewer__code', pretty(token.value)));
    if (resolved.from !== key) {
      const line = el('p', 'dtgraph-viewer__muted');
      line.append(
        document.createTextNode(resolved.complete ? 'Resolves to ' : 'Stops at '),
        el('code', undefined, pretty(resolved.value)),
        document.createTextNode(' via '),
      );
      const via = button('dtgraph-viewer__link', resolved.from, () =>
        options.onNavigate(resolved.from),
      );
      line.appendChild(via);
      valueSection.appendChild(line);
    }
    element.appendChild(valueSection);

    const dependsOn = options.graph.outEdges(key).map((edge) => {
      const e = options.graph.getEdgeAttributes(edge);
      return { key: options.graph.target(edge), note: e.member };
    });
    const usedBy = options.graph.inEdges(key).map((edge) => {
      const e = options.graph.getEdgeAttributes(edge);
      return { key: options.graph.source(edge), note: e.member };
    });
    const indirect = attrs.dependents - new Set(usedBy.map((item) => item.key)).size;
    const dependsSection = relationList('Depends on', dependsOn);
    if (dependsSection !== undefined) element.appendChild(dependsSection);
    const usedSection = relationList(
      'Used by',
      usedBy,
      indirect > 0 ? `and ${indirect} more indirectly` : undefined,
    );
    if (usedSection !== undefined) element.appendChild(usedSection);
    if (dependsSection === undefined && usedSection === undefined) {
      element.appendChild(
        el('p', 'dtgraph-viewer__muted', 'Not referenced by, or referencing, any other token.'),
      );
    }

    element.hidden = false;
    element.scrollTop = 0;
  };

  return {
    element,
    show,
    hide: () => {
      element.hidden = true;
    },
    destroy: () => element.remove(),
  };
}
