import { button, el } from './dom.js';

export interface ActivationGateOptions {
  /** Called with `true` when the visitor hands gestures to the map, `false` when they give them back. */
  onChange(held: boolean): void;
}

export interface ActivationGate {
  /** Covers the map while the page owns gestures; a tap anywhere on it hands them over. */
  veil: HTMLElement;
  /** Gives them back. Only shown once the map is holding them. */
  release: HTMLElement;
  destroy(): void;
}

/**
 * The bargain a map embedded in a scrolling page has to strike on a touchscreen: a finger that
 * lands on it should scroll the article, not pan the graph, until the visitor says otherwise.
 * So the viewer starts passive behind a veil that lets the page scroll straight through it, and
 * a tap hands gestures to the map until the visitor taps Done (or scrolls it out of sight).
 *
 * A viewer that fills the screen has no page to scroll and never puts this in the way — see
 * `isFullBleed`, and `data-gesture` in `style.css` for which state shows what.
 */
export function createActivationGate(options: ActivationGateOptions): ActivationGate {
  const veil = el('div', 'dtgraph-viewer__veil');
  const hint = el('button', 'dtgraph-viewer__pill', 'Tap to explore');
  hint.type = 'button';
  veil.appendChild(hint);
  // One listener for the whole veil: a tap on the pill bubbles up to it, and a tap on bare map
  // means the same thing. A scroll never becomes a click, so the page still scrolls freely.
  const activate = (): void => options.onChange(true);
  veil.addEventListener('click', activate);

  const release = button('dtgraph-viewer__pill dtgraph-viewer__release', 'Done', () =>
    options.onChange(false),
  );
  release.title = 'Done exploring — scroll the page again';

  return {
    veil,
    release,
    destroy: () => {
      veil.removeEventListener('click', activate);
      veil.remove();
      release.remove();
    },
  };
}
