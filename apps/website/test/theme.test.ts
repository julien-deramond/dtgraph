import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THEME_STORAGE_KEY,
  applyTheme,
  onSiteThemeChange,
  readStoredTheme,
  resolveSiteTheme,
  restoreStoredTheme,
  systemTheme,
} from '../src/lib/theme.js';

type MediaListener = (event: MediaQueryListEvent) => void;

/** jsdom has no matchMedia; a stub whose `matches` and listeners the tests can drive. */
function stubMatchMedia(prefersDark: boolean): {
  listeners: Set<MediaListener>;
  query: { matches: boolean };
} {
  const listeners = new Set<MediaListener>();
  const query = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query));
  return { listeners, query };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('resolveSiteTheme', () => {
  it('prefers an explicit data-theme over the system preference', () => {
    stubMatchMedia(true);
    document.documentElement.dataset.theme = 'light';
    expect(resolveSiteTheme()).toBe('light');
  });

  it('falls back to the system preference', () => {
    stubMatchMedia(true);
    expect(systemTheme()).toBe('dark');
    expect(resolveSiteTheme()).toBe('dark');
    document.documentElement.dataset.theme = 'sepia';
    expect(resolveSiteTheme()).toBe('dark');
  });
});

describe('applyTheme / readStoredTheme / restoreStoredTheme', () => {
  it('sets the attribute and remembers the choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue');
    expect(readStoredTheme()).toBeUndefined();
    expect(restoreStoredTheme()).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('restores a stored choice onto the document', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(restoreStoredTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('onSiteThemeChange', () => {
  it('reports attribute changes, only when the effective theme actually changes', async () => {
    stubMatchMedia(false);
    const listener = vi.fn();
    const stop = onSiteThemeChange(listener);

    document.documentElement.dataset.theme = 'light'; // same as the system: no change
    await flush();
    expect(listener).not.toHaveBeenCalled();

    document.documentElement.dataset.theme = 'dark';
    await flush();
    expect(listener).toHaveBeenCalledExactlyOnceWith('dark');

    stop();
    document.documentElement.dataset.theme = 'light';
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('follows the system while no explicit theme is set', () => {
    const { listeners, query } = stubMatchMedia(false);
    const listener = vi.fn();
    onSiteThemeChange(listener);

    query.matches = true;
    for (const notify of listeners) notify({} as MediaQueryListEvent);
    expect(listener).toHaveBeenCalledExactlyOnceWith('dark');
  });
});
