import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasCoarsePointer,
  isFullBleed,
  motionDuration,
  prefersReducedMotion,
  stagePaddingFor,
} from '../src/environment.js';

/** Make `matchMedia` answer `true` for exactly the queries listed. */
function stubMedia(...trueFor: string[]): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: trueFor.includes(query) }));
}

function sizedElement(rect: { width: number; height: number }): HTMLElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({ ...rect, top: 0, left: 0, right: rect.width, bottom: rect.height }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pointer and motion preferences', () => {
  it('reads the pointer and motion queries', () => {
    stubMedia('(pointer: coarse)');
    expect(hasCoarsePointer()).toBe(true);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionDuration(450)).toBe(450);

    stubMedia('(prefers-reduced-motion: reduce)');
    expect(hasCoarsePointer()).toBe(false);
    expect(motionDuration(450)).toBe(0);
  });

  it('assumes nothing where matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(hasCoarsePointer()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('isFullBleed', () => {
  it('is true only for a container that covers the viewport', () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 844);

    expect(isFullBleed(sizedElement({ width: 390, height: 700 }))).toBe(true);
    // A docs embed: full width of the column, a fraction of the screen's height.
    expect(isFullBleed(sizedElement({ width: 358, height: 480 }))).toBe(false);
    // Not yet laid out.
    expect(isFullBleed(sizedElement({ width: 0, height: 0 }))).toBe(false);
  });
});

describe('stagePaddingFor', () => {
  it('scales the framing margin with the container and clamps both ends', () => {
    expect(stagePaddingFor(1440)).toBe(48);
    expect(stagePaddingFor(390)).toBe(35);
    expect(stagePaddingFor(120)).toBe(16);
    // An unmeasured container keeps the desktop default until it has a size.
    expect(stagePaddingFor(0)).toBe(48);
  });
});
