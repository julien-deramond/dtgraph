/**
 * The site's light/dark theme, shared by the header toggle (which sets it), the playground
 * (whose graph canvas follows it) and `@dtgraph/mdx`'s `<TokenGraph>` embeds in the docs (which
 * read the same attribute). The single source of truth is `<html data-theme="light|dark">`:
 * the CSS in `src/styles/tokens.css` switches its `color-scheme` on it, and everything that
 * draws to a canvas resolves its palette from it. When the attribute is absent, the system's
 * `prefers-color-scheme` applies — no JavaScript is needed for the site to render in the
 * system theme; a stored choice is only applied once this module runs.
 */

export type SiteTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dtgraph-theme';

function isTheme(value: unknown): value is SiteTheme {
  return value === 'light' || value === 'dark';
}

/** The theme the visitor picked earlier on this browser, if any. */
export function readStoredTheme(
  storage: Storage | undefined = safeStorage(),
): SiteTheme | undefined {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    // Storage access can throw (privacy modes, blocked cookies); the theme simply won't persist.
    return undefined;
  }
}

/** Whether the system prefers dark, when nothing was chosen explicitly. */
export function systemTheme(win: Window = window): SiteTheme {
  return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme in effect right now: the explicit `data-theme` if set, else the system preference. */
export function resolveSiteTheme(doc: Document = document): SiteTheme {
  const explicit = doc.documentElement.dataset.theme;
  return isTheme(explicit) ? explicit : systemTheme(doc.defaultView ?? window);
}

/** Set the theme on `<html>` and remember it for next time. */
export function applyTheme(theme: SiteTheme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  try {
    safeStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // See safeStorage(): persisting is best-effort.
  }
}

/** Re-apply a stored choice on page load; a no-op when the visitor never chose. */
export function restoreStoredTheme(doc: Document = document): SiteTheme | undefined {
  const stored = readStoredTheme();
  if (stored !== undefined) doc.documentElement.dataset.theme = stored;
  return stored;
}

/**
 * Call `listener` with the effective theme whenever it changes — from the toggle (a
 * `data-theme` mutation) or from the system (while no explicit theme is set). Returns a
 * function that stops listening.
 */
export function onSiteThemeChange(
  listener: (theme: SiteTheme) => void,
  doc: Document = document,
): () => void {
  let current = resolveSiteTheme(doc);
  const check = (): void => {
    const next = resolveSiteTheme(doc);
    if (next === current) return;
    current = next;
    listener(next);
  };
  const observer = new MutationObserver(check);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = (doc.defaultView ?? window).matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', check);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', check);
  };
}
