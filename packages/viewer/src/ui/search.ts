import type { SearchHit } from '../search.js';
import { dot, el, pathLabel } from './dom.js';

export interface SearchRow {
  key: string;
  color: string;
  tokenType: string;
}

export interface SearchBoxOptions {
  search(query: string): SearchHit[];
  rowFor(key: string): SearchRow;
  onPick(key: string): void;
}

export interface SearchBox {
  element: HTMLElement;
  focus(): void;
  clear(): void;
  destroy(): void;
}

/**
 * A search field with a keyboard-navigable results list. Rows are built from DOM nodes and
 * `textContent`, so token paths can contain anything.
 */
export function createSearchBox(options: SearchBoxOptions): SearchBox {
  const element = el('div', 'dtgraph-viewer__search');
  const input = el('input', 'dtgraph-viewer__search-input');
  input.type = 'search';
  input.placeholder = 'Search tokens';
  input.setAttribute('aria-label', 'Search tokens');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const list = el('ul', 'dtgraph-viewer__search-results');
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const kbd = el('kbd', 'dtgraph-viewer__search-kbd', '/');
  element.append(input, kbd, list);

  let hits: SearchHit[] = [];
  let active = -1;

  const render = (): void => {
    list.replaceChildren();
    if (input.value.trim() === '') {
      list.hidden = true;
      return;
    }
    if (hits.length === 0) {
      list.appendChild(el('li', 'dtgraph-viewer__search-empty', 'No matching token'));
    }
    hits.forEach((hit, index) => {
      const row = options.rowFor(hit.key);
      const item = el('li', 'dtgraph-viewer__search-row');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === active));
      item.append(
        dot(row.color),
        pathLabel(hit.key),
        el('span', 'dtgraph-viewer__chip', row.tokenType),
      );
      item.addEventListener('mousedown', (event) => {
        event.preventDefault(); // keep the input focused
        pick(hit.key);
      });
      list.appendChild(item);
    });
    list.hidden = false;
  };

  const pick = (key: string): void => {
    options.onPick(key);
    input.value = '';
    hits = [];
    active = -1;
    render();
    input.blur();
  };

  const onInput = (): void => {
    hits = options.search(input.value);
    active = hits.length > 0 ? 0 : -1;
    render();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + delta + hits.length) % hits.length;
      render();
    } else if (event.key === 'Enter') {
      if (active >= 0 && active < hits.length) {
        event.preventDefault();
        pick(hits[active].key);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      clear();
      input.blur();
    }
    event.stopPropagation();
  };

  const clear = (): void => {
    input.value = '';
    hits = [];
    active = -1;
    render();
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', () => {
    list.hidden = true;
  });
  input.addEventListener('focus', () => {
    if (hits.length > 0 || input.value.trim() !== '') render();
  });

  return {
    element,
    focus: () => input.focus(),
    clear,
    destroy: () => element.remove(),
  };
}
