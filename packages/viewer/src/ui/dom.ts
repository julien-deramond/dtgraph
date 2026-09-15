/** Tiny DOM helpers. Everything goes through `textContent`; no HTML strings, ever. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el('button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

/** A colored dot, for legends and result rows. */
export function dot(color: string): HTMLSpanElement {
  const element = el('span', 'dtgraph-viewer__dot');
  element.style.background = color;
  return element;
}

/** A token path as `group.sub.` + **name**, so the distinctive part stands out. */
export function pathLabel(path: string): HTMLSpanElement {
  const element = el('span', 'dtgraph-viewer__path');
  const index = path.lastIndexOf('.');
  if (index >= 0)
    element.appendChild(el('span', 'dtgraph-viewer__path-prefix', path.slice(0, index + 1)));
  element.appendChild(el('strong', undefined, path.slice(index + 1)));
  return element;
}
