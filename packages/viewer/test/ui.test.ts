import { describe, expect, it, vi } from 'vitest';

import { buildViewerGraph } from '../src/build-graph.js';
import { searchTokens } from '../src/search.js';
import { createLegend } from '../src/ui/legend.js';
import { createDetailPanel } from '../src/ui/panel.js';
import { createSearchBox } from '../src/ui/search.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

const tokenGraph = tokenGraphFrom(SAMPLE);
const graph = buildViewerGraph(tokenGraph);

function key(input: HTMLElement, name: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

describe('search box', () => {
  function setup() {
    const onPick = vi.fn();
    const box = createSearchBox({
      search: (query) => searchTokens(graph, query),
      rowFor: (k) => ({ key: k, color: '#fff', tokenType: graph.getNodeAttribute(k, 'tokenType') }),
      onPick,
    });
    document.body.appendChild(box.element);
    const input = box.element.querySelector('input') as HTMLInputElement;
    const list = box.element.querySelector('ul') as HTMLUListElement;
    return { box, input, list, onPick };
  }

  it('lists ranked results as the user types, first one active', () => {
    const { input, list } = setup();
    input.value = 'text';
    input.dispatchEvent(new Event('input'));
    const rows = list.querySelectorAll('[role="option"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
    expect(rows[0].textContent).toContain('text');
    expect(list.hidden).toBe(false);
  });

  it('navigates with arrows and picks with Enter, then resets', () => {
    const { input, list, onPick } = setup();
    input.value = 'text';
    input.dispatchEvent(new Event('input'));
    key(input, 'ArrowDown');
    expect(list.querySelectorAll('[role="option"]')[1].getAttribute('aria-selected')).toBe('true');
    key(input, 'Enter');
    expect(onPick).toHaveBeenCalledWith('semantic.text');
    expect(input.value).toBe('');
    expect(list.hidden).toBe(true);
  });

  it('shows an empty state and clears on Escape', () => {
    const { input, list } = setup();
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    expect(list.textContent).toContain('No matching token');
    key(input, 'Escape');
    expect(input.value).toBe('');
    expect(list.hidden).toBe(true);
  });

  it('never turns token paths into markup', () => {
    const evil = buildViewerGraph(
      tokenGraphFrom({ '<img src=x onerror=alert(1)>': { $value: 1 } }),
    );
    const box = createSearchBox({
      search: (query) => searchTokens(evil, query),
      rowFor: (k) => ({ key: k, color: '#fff', tokenType: 'untyped' }),
      onPick: () => {},
    });
    const input = box.element.querySelector('input') as HTMLInputElement;
    input.value = 'img';
    input.dispatchEvent(new Event('input'));
    expect(box.element.querySelector('img')).toBeNull();
    expect(box.element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('detail panel', () => {
  function setup() {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const panel = createDetailPanel({ graph, tokenGraph, onNavigate, onClose });
    document.body.appendChild(panel.element);
    return { panel, onNavigate, onClose };
  }

  it('shows identity, chips, value, resolution and relations for an alias token', () => {
    const { panel } = setup();
    panel.show('button.background');
    const text = panel.element.textContent ?? '';
    expect(panel.element.hidden).toBe(false);
    expect(panel.element.querySelector('h2')?.textContent).toBe('button.background');
    expect(text).toContain('color'); // type chip
    expect(text).toContain('button'); // group chip
    expect(text).toContain('{semantic.primary}'); // raw value
    expect(text).toContain('Resolves to');
    expect(text).toContain('#3b82f6');
    expect(text).toContain('color.blue');
    expect(text).toContain('Depends on (1)');
    const swatch = panel.element.querySelector<HTMLElement>('.dtgraph-viewer__swatch');
    expect(swatch?.style.background).toBe('rgb(59, 130, 246)');
  });

  it('lists direct and indirect dependents and composite member names', () => {
    const { panel } = setup();
    panel.show('color.gray');
    const text = panel.element.textContent ?? '';
    expect(text).toContain('Used by (2)');
    expect(text).toContain('and 1 more indirectly');
    expect(text).toContain('semantic.text');
    expect(text).toContain('button.border');
    expect(text).toContain('color'); // the border's member name chip
    expect(text).not.toContain('Depends on');
  });

  it('navigates to related tokens and closes', () => {
    const { panel, onNavigate, onClose } = setup();
    panel.show('button.background');
    const relation = panel.element.querySelector<HTMLButtonElement>('.dtgraph-viewer__relation');
    relation?.click();
    expect(onNavigate).toHaveBeenCalledWith('semantic.primary');
    panel.element.querySelector<HTMLButtonElement>('.dtgraph-viewer__close')?.click();
    expect(onClose).toHaveBeenCalled();
    panel.hide();
    expect(panel.element.hidden).toBe(true);
  });

  it('describes an isolated token honestly', () => {
    const { panel } = setup();
    panel.show('spacing.md');
    expect(panel.element.textContent).toContain('Not referenced by, or referencing');
  });
});

describe('legend', () => {
  it('solos a category on click and clears on a second click', () => {
    const onSolo = vi.fn();
    const legend = createLegend({
      title: 'Groups',
      entries: [
        { key: 'color', label: 'color', color: '#f00', count: 3 },
        { key: 'button', label: 'button', color: '#0f0', count: 3 },
      ],
      onSolo,
    });
    document.body.appendChild(legend.element);
    expect(legend.element.textContent).toContain('Groups');
    expect(legend.element.textContent).toContain('3');
    const [first] = legend.element.querySelectorAll<HTMLButtonElement>(
      '.dtgraph-viewer__legend-item',
    );
    first.click();
    expect(onSolo).toHaveBeenLastCalledWith('color');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    first.click();
    expect(onSolo).toHaveBeenLastCalledWith(null);
    expect(first.getAttribute('aria-pressed')).toBe('false');
  });
});
