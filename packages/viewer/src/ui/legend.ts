import { button, dot, el } from './dom.js';

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  count: number;
}

export interface LegendOptions {
  title: string;
  entries: LegendEntry[];
  /** Start expanded. Defaults to expanding when the list is short enough to be worth showing. */
  open?: boolean;
  /** Called with the solo'd category key, or `null` when cleared. */
  onSolo(key: string | null): void;
}

export interface Legend {
  element: HTMLElement;
  setActive(key: string | null): void;
  destroy(): void;
}

/** Categories with their colors; click one to solo it (dim everything else), click again to clear. */
export function createLegend(options: LegendOptions): Legend {
  const element = el('details', 'dtgraph-viewer__legend');
  element.open = options.open ?? options.entries.length <= 16;
  element.appendChild(el('summary', 'dtgraph-viewer__legend-title', options.title));
  const list = el('ul', 'dtgraph-viewer__legend-list');
  const buttons = new Map<string, HTMLButtonElement>();
  let active: string | null = null;

  const setActive = (key: string | null): void => {
    active = key;
    for (const [entryKey, entryButton] of buttons) {
      entryButton.setAttribute('aria-pressed', String(entryKey === key));
    }
  };

  for (const entry of options.entries) {
    const li = el('li');
    const entryButton = button('dtgraph-viewer__legend-item', '', () => {
      const next = active === entry.key ? null : entry.key;
      setActive(next);
      options.onSolo(next);
    });
    entryButton.setAttribute('aria-pressed', 'false');
    entryButton.append(
      dot(entry.color),
      el('span', 'dtgraph-viewer__legend-label', entry.label),
      el('span', 'dtgraph-viewer__legend-count', String(entry.count)),
    );
    buttons.set(entry.key, entryButton);
    li.appendChild(entryButton);
    list.appendChild(li);
  }
  element.appendChild(list);

  return { element, setActive, destroy: () => element.remove() };
}
