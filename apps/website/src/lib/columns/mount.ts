/**
 * Prototype for #139: a DOM column view of a token graph. Tokens are text rows in one column per
 * tier, grouped under family headings; focusing a token draws SVG connectors to what it
 * references and what references it. Framework-free and depends on `@dtgraph/core` only (the
 * viewer's value helpers are copied in `values.ts`), so it could become its own package without
 * sigma or graphology.
 *
 * Throwaway: written to answer the study's questions, not to be shipped as is.
 */
import type { TokenEdge, TokenGraph, TokenNode } from '@dtgraph/core';

import { collectDownstream, collectUpstream, focusEdges, keyOf, matchesQuery } from './graph.js';
import { assignColumns, familyOf, type TierStrategy } from './tiers.js';
import { resolveTokenTypes, resolveValue, swatchColor } from './values.js';

export type KindFilter = 'all' | 'color' | 'dimension' | 'typography' | 'other';

export interface ColumnsOptions {
  strategy?: TierStrategy;
  /** Draw the whole upstream and downstream chains instead of one hop each way. */
  fullChain?: boolean;
  /** On focus, scroll each column so at least one connected row is visible. */
  autoScroll?: boolean;
  /** Sources for builds that don't tag `TokenNode.source` (plain multi-file input). */
  sourceOf?: (node: TokenNode) => string | undefined;
}

export interface ColumnsView {
  /** Milliseconds spent building the DOM on mount. */
  readonly renderMs: number;
  setFilter(query: string, kind: KindFilter): void;
  setFullChain(fullChain: boolean): void;
  setAutoScroll(autoScroll: boolean): void;
  select(key: string | undefined): void;
  destroy(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
/** Fixed row height (px), mirrored in columns.css; lets offscreen families skip layout. */
const ROW_HEIGHT = 28;
const FAMILY_HEADING = 26;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function kindOf(type: string): Exclude<KindFilter, 'all'> {
  if (type === 'color') return 'color';
  if (type === 'dimension') return 'dimension';
  if (['typography', 'fontFamily', 'fontWeight'].includes(type)) return 'typography';
  return 'other';
}

/** A short text preview of a resolved value, or `undefined` for composites (shown as a chip). */
function preview(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 28 ? `${value.slice(0, 27)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if ('value' in v && 'unit' in v && Object.keys(v).length === 2) return `${v.value}${v.unit}`;
    if (typeof v.hex === 'string' && 'colorSpace' in v) return v.hex;
  }
  return undefined;
}

interface Row {
  key: string;
  node: TokenNode;
  column: number;
  kind: Exclude<KindFilter, 'all'>;
  button: HTMLButtonElement;
  item: HTMLLIElement;
}

interface Column {
  section: HTMLElement;
  list: HTMLUListElement;
  badge: HTMLElement;
  above: HTMLButtonElement;
  below: HTMLButtonElement;
  rows: Row[];
  families: { item: HTMLLIElement; rows: Row[] }[];
}

export function mountColumns(
  container: HTMLElement,
  graph: TokenGraph,
  options: ColumnsOptions = {},
): ColumnsView {
  const started = performance.now();
  let fullChain = options.fullChain ?? false;
  let autoScroll = options.autoScroll ?? true;
  const assignment = assignColumns(graph, options.strategy ?? 'group-role', options.sourceOf);
  const types = resolveTokenTypes(graph);

  const root = el('div', 'dtcols');
  const grid = el('div', 'dtcols__columns');
  const links = document.createElementNS(SVG, 'svg');
  links.classList.add('dtcols__links');
  links.setAttribute('aria-hidden', 'true');
  const detail = el('p', 'dtcols__detail');
  detail.setAttribute('aria-live', 'polite');
  detail.textContent = 'Select a token to see what it references and what uses it.';

  const rows = new Map<string, Row>();
  const columns: Column[] = assignment.columns.map((spec, index) => {
    const section = el('section', 'dtcols__column');
    const header = el('header', 'dtcols__header');
    const heading = el('h2', 'dtcols__title', spec.label);
    heading.id = `dtcols-col-${index}`;
    section.setAttribute('aria-labelledby', heading.id);
    const badge = el('span', 'dtcols__badge');
    header.append(heading, badge);
    const body = el('div', 'dtcols__body');
    const list = el('ul', 'dtcols__list');
    list.setAttribute('aria-labelledby', heading.id);
    const above = el('button', 'dtcols__more dtcols__more--above');
    const below = el('button', 'dtcols__more dtcols__more--below');
    above.type = below.type = 'button';
    above.hidden = below.hidden = true;
    body.append(list, above, below);
    section.append(header, body);
    grid.append(section);
    return { section, list, badge, above, below, rows: [], families: [] };
  });

  // Rows in declaration order, grouped by family in first-seen order.
  const familyItems = new Map<string, { item: HTMLLIElement; rows: Row[]; ul: HTMLUListElement }>();
  for (const node of graph.nodes) {
    const key = keyOf(node.path);
    const columnIndex = assignment.columnOf.get(key) ?? 0;
    const column = columns[columnIndex];
    const family = familyOf(node.path);
    const familyKey = `${columnIndex}:${family}`;
    let entry = familyItems.get(familyKey);
    if (entry === undefined) {
      const item = el('li', 'dtcols__family');
      const title = el('h3', 'dtcols__family-title', family === '' ? '(root)' : family);
      const ul = el('ul', 'dtcols__rows');
      item.append(title, ul);
      column.list.append(item);
      entry = { item, rows: [], ul };
      familyItems.set(familyKey, entry);
      column.families.push(entry);
    }

    const type = types.get(key) ?? 'untyped';
    const resolved = resolveValue(graph, node.path);
    const swatch = swatchColor(type, resolved.value);
    const text = preview(resolved.value);
    const button = el('button', 'dtcols__row');
    button.type = 'button';
    button.tabIndex = -1;
    button.dataset.key = key;
    const label = family === '' ? key : key.slice(family.length + 1);
    if (swatch !== undefined) {
      const chip = el('span', 'dtcols__swatch');
      chip.style.background = swatch;
      button.append(chip);
    } else {
      button.append(el('span', 'dtcols__type', type === 'untyped' ? '–' : type.slice(0, 4)));
    }
    button.append(el('span', 'dtcols__name', label));
    if (text !== undefined && swatch === undefined)
      button.append(el('span', 'dtcols__value', text));
    button.setAttribute('aria-label', `${key}, ${type}${text === undefined ? '' : `, ${text}`}`);
    button.setAttribute('aria-pressed', 'false');
    const item = el('li');
    item.append(button);
    entry.ul.append(item);
    const row: Row = { key, node, column: columnIndex, kind: kindOf(type), button, item };
    entry.rows.push(row);
    column.rows.push(row);
    rows.set(key, row);
  }
  for (const entry of familyItems.values()) {
    // Offscreen families skip rendering; their reserved height keeps the scrollbar honest.
    entry.item.style.containIntrinsicSize = `auto ${FAMILY_HEADING + entry.rows.length * ROW_HEIGHT}px`;
  }
  for (const column of columns) {
    if (column.rows.length > 0) column.rows[0].button.tabIndex = 0;
  }

  grid.append(links);
  root.append(grid, detail);
  container.replaceChildren(root);
  const renderMs = performance.now() - started;

  // --- Filtering ------------------------------------------------------------------------------
  const visible = (row: Row): boolean => !row.item.hidden;

  function updateBadges(): void {
    for (const column of columns) {
      const shown = column.rows.filter(visible).length;
      column.badge.textContent =
        shown === column.rows.length ? String(shown) : `${shown} / ${column.rows.length}`;
    }
  }

  function setFilter(query: string, kind: KindFilter): void {
    for (const row of rows.values()) {
      row.item.hidden =
        (kind !== 'all' && row.kind !== kind) || (query !== '' && !matchesQuery(row.key, query));
    }
    for (const column of columns) {
      for (const family of column.families) family.item.hidden = !family.rows.some(visible);
      // Keep one visible row per column reachable with Tab.
      const current = column.rows.find((row) => row.button.tabIndex === 0);
      if (current === undefined || !visible(current)) {
        const first = column.rows.find(visible);
        if (current !== undefined) current.button.tabIndex = -1;
        if (first !== undefined) first.button.tabIndex = 0;
      }
    }
    updateBadges();
    scheduleDraw();
  }

  // --- Focus and connectors -------------------------------------------------------------------
  let selected: string | undefined;
  let drawn: TokenEdge[] = [];

  function relation(key: string): { upstream: Set<string>; downstream: Set<string> } {
    if (fullChain)
      return { upstream: collectUpstream(graph, key), downstream: collectDownstream(graph, key) };
    const path = key.split('.');
    return {
      upstream: new Set(graph.getOutgoingEdges(path).map((e) => keyOf(e.to))),
      downstream: new Set(graph.getIncomingEdges(path).map((e) => keyOf(e.from))),
    };
  }

  function describe(key: string, upstream: Set<string>, downstream: Set<string>): string {
    const row = rows.get(key) as Row;
    const resolved = resolveValue(graph, row.node.path);
    const value = preview(resolved.value) ?? types.get(key) ?? '';
    const via = resolved.from === key ? '' : ` via ${resolved.from}`;
    const list = (set: Set<string>): string => {
      const items = [...set];
      return items.length <= 6
        ? items.join(', ')
        : `${items.slice(0, 6).join(', ')} and ${items.length - 6} more`;
    };
    const skips = drawn.filter(
      (e) =>
        Math.abs((rows.get(keyOf(e.from))?.column ?? 0) - (rows.get(keyOf(e.to))?.column ?? 0)) > 1,
    ).length;
    const scope = fullChain ? 'chain' : 'direct';
    return (
      `${key} (${assignment.columns[row.column].label}): ${value}${via}. ` +
      `References ${upstream.size} (${scope})${upstream.size > 0 ? `: ${list(upstream)}` : ''}. ` +
      `Used by ${downstream.size} (${scope})${downstream.size > 0 ? `: ${list(downstream)}` : ''}.` +
      (skips > 0 ? ` ${skips} link${skips === 1 ? ' skips' : 's skip'} a tier.` : '')
    );
  }

  function select(key: string | undefined): void {
    selected = key !== undefined && rows.has(key) ? key : undefined;
    root.classList.toggle('dtcols--focused', selected !== undefined);
    for (const row of rows.values()) {
      row.button.removeAttribute('data-rel');
      row.button.setAttribute('aria-pressed', 'false');
    }
    if (selected === undefined) {
      drawn = [];
      detail.textContent = 'Select a token to see what it references and what uses it.';
      scheduleDraw();
      return;
    }
    const { upstream, downstream } = relation(selected);
    const selectedRow = rows.get(selected) as Row;
    selectedRow.button.dataset.rel = 'self';
    selectedRow.button.setAttribute('aria-pressed', 'true');
    for (const k of upstream) rows.get(k)?.button.setAttribute('data-rel', 'upstream');
    for (const k of downstream) rows.get(k)?.button.setAttribute('data-rel', 'downstream');
    drawn = focusEdges(graph, selected, fullChain);
    detail.textContent = describe(selected, upstream, downstream);
    if (autoScroll) revealRelated(upstream, downstream);
    scheduleDraw();
  }

  /**
   * Scroll a row to the middle of its own column. Not `scrollIntoView`, which also scrolls the
   * page around the view, and not `offsetTop`, which `content-visibility` makes relative to the
   * row's family.
   */
  function centerRow(row: Row): void {
    const list = columns[row.column].list;
    const offset = row.button.getBoundingClientRect().top - list.getBoundingClientRect().top;
    list.scrollTop += offset - list.clientHeight / 2 + ROW_HEIGHT / 2;
  }

  /** Whether a row is at least partly inside its column's scroll viewport. */
  function inView(row: Row): boolean {
    const box = columns[row.column].list.getBoundingClientRect();
    const r = row.button.getBoundingClientRect();
    return r.bottom > box.top && r.top < box.bottom;
  }

  /** In each column, bring the first related row into view unless one already is. */
  function revealRelated(upstream: Set<string>, downstream: Set<string>): void {
    const related = [...upstream, ...downstream]
      .map((k) => rows.get(k))
      .filter((row): row is Row => row !== undefined && visible(row));
    for (const column of columns) {
      const inColumn = related.filter((row) => row.column === columns.indexOf(column));
      if (inColumn.length === 0) continue;
      if (!inColumn.some(inView)) centerRow(inColumn[0]);
    }
  }

  let frame = 0;
  function scheduleDraw(): void {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  interface Anchor {
    x1: number;
    x2: number;
    y: number;
    clipped: 'above' | 'below' | undefined;
  }

  function draw(): void {
    links.replaceChildren();
    const gridBox = grid.getBoundingClientRect();
    links.setAttribute('width', String(grid.scrollWidth));
    links.setAttribute('height', String(grid.clientHeight));
    const offscreen = columns.map(() => ({ above: [] as Row[], below: [] as Row[] }));

    const anchor = (row: Row): Anchor | undefined => {
      if (!visible(row)) return undefined;
      const box = columns[row.column].list.getBoundingClientRect();
      const r = row.button.getBoundingClientRect();
      const x1 = r.left - gridBox.left + grid.scrollLeft;
      const x2 = r.right - gridBox.left + grid.scrollLeft;
      if (r.bottom <= box.top) return { x1, x2, y: box.top - gridBox.top + 2, clipped: 'above' };
      if (r.top >= box.bottom) return { x1, x2, y: box.bottom - gridBox.top - 2, clipped: 'below' };
      return { x1, x2, y: r.top + r.height / 2 - gridBox.top, clipped: undefined };
    };

    const counted = new Set<string>();
    for (const edge of drawn) {
      const consumer = rows.get(keyOf(edge.from));
      const source = rows.get(keyOf(edge.to));
      if (consumer === undefined || source === undefined) continue;
      const a = anchor(consumer);
      const b = anchor(source);
      if (a === undefined || b === undefined) continue;
      for (const [row, at] of [
        [consumer, a],
        [source, b],
      ] as const) {
        if (at.clipped !== undefined && !counted.has(row.key)) {
          counted.add(row.key);
          offscreen[row.column][at.clipped].push(row);
        }
      }
      let d: string;
      if (source.column === consumer.column) {
        // Same tier: a loop out to the right of the column.
        const x = Math.max(a.x2, b.x2);
        d = `M ${x} ${b.y} C ${x + 36} ${b.y}, ${x + 36} ${a.y}, ${x} ${a.y}`;
      } else {
        const [left, right] = source.column < consumer.column ? [b, a] : [a, b];
        const dx = Math.max(24, (right.x1 - left.x2) / 2);
        d = `M ${left.x2} ${left.y} C ${left.x2 + dx} ${left.y}, ${right.x1 - dx} ${right.y}, ${right.x1} ${right.y}`;
      }
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      const classes = ['dtcols__link'];
      if (edge.kind === 'composite-member') classes.push('dtcols__link--member');
      if (Math.abs(source.column - consumer.column) > 1) classes.push('dtcols__link--skip');
      if (a.clipped !== undefined || b.clipped !== undefined) classes.push('dtcols__link--clipped');
      path.setAttribute('class', classes.join(' '));
      links.append(path);
      if (
        edge.kind === 'composite-member' &&
        edge.member !== undefined &&
        a.clipped === undefined
      ) {
        const label = document.createElementNS(SVG, 'text');
        label.setAttribute('x', String(a.x1 - 4));
        label.setAttribute('y', String(a.y - 4));
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('class', 'dtcols__member');
        label.textContent = edge.member;
        links.append(label);
      }
    }

    columns.forEach((column, index) => {
      for (const side of ['above', 'below'] as const) {
        const button = column[side];
        const list = offscreen[index][side];
        button.hidden = list.length === 0;
        if (list.length === 0) continue;
        button.textContent = `${side === 'above' ? '↑' : '↓'} ${list.length} ${side}`;
        button.onclick = () => {
          centerRow(list[side === 'above' ? list.length - 1 : 0]);
        };
      }
    });
  }

  // --- Events ---------------------------------------------------------------------------------
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.dtcols__row');
    if (button === null) return;
    const key = button.dataset.key as string;
    focusRow(rows.get(key) as Row);
    select(selected === key ? undefined : key);
  });

  function focusRow(row: Row): void {
    for (const other of columns[row.column].rows) other.button.tabIndex = -1;
    row.button.tabIndex = 0;
    row.button.focus({ preventScroll: true });
    if (!inView(row)) centerRow(row);
  }

  root.addEventListener('keydown', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.dtcols__row');
    if (button === null) {
      if (event.key === 'Escape') select(undefined);
      return;
    }
    const row = rows.get(button.dataset.key as string) as Row;
    const shown = columns[row.column].rows.filter(visible);
    const index = shown.indexOf(row);
    let target: Row | undefined;
    switch (event.key) {
      case 'ArrowDown':
        target = shown[index + 1];
        break;
      case 'ArrowUp':
        target = shown[index - 1];
        break;
      case 'Home':
        target = shown[0];
        break;
      case 'End':
        target = shown[shown.length - 1];
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        // Walk the lineage: jump to the nearest connected token in that direction and focus it.
        const step = event.key === 'ArrowLeft' ? -1 : 1;
        const { upstream, downstream } = relation(row.key);
        const isRelated = (r: Row): boolean =>
          visible(r) && (upstream.has(r.key) || downstream.has(r.key));
        for (let c = row.column + step; c >= 0 && c < columns.length && !target; c += step) {
          target = columns[c].rows.find(isRelated);
        }
        if (target !== undefined) {
          event.preventDefault();
          focusRow(target);
          select(target.key);
          return;
        }
        // Nothing connected that way: just move to the next column.
        const next = columns[row.column + step];
        target =
          next?.rows.find((r) => visible(r) && r.button.tabIndex === 0) ?? next?.rows.find(visible);
        break;
      }
      case 'Escape':
        select(undefined);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (target !== undefined) focusRow(target);
  });

  const lists = columns.map((column) => column.list);
  for (const list of lists) list.addEventListener('scroll', scheduleDraw, { passive: true });
  grid.addEventListener('scroll', scheduleDraw, { passive: true });
  const resize = new ResizeObserver(scheduleDraw);
  resize.observe(grid);

  updateBadges();

  return {
    renderMs,
    setFilter,
    setFullChain(next) {
      fullChain = next;
      select(selected);
    },
    setAutoScroll(next) {
      autoScroll = next;
    },
    select,
    destroy() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      for (const list of lists) list.removeEventListener('scroll', scheduleDraw);
      container.replaceChildren();
    },
  };
}
