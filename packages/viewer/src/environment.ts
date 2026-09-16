/**
 * What the viewer can tell about the browser and the box it was mounted into. Everything here is
 * a capability or a measurement, never a device guess: the same phone gets finger-sized chrome
 * inside a docs embed and full-bleed chrome in the playground, and a desktop browser with a
 * touchscreen gets the touch treatment without being called a phone.
 */

/** Container width at or below which the chrome folds into its narrow composition (see style.css). */
export const COMPACT_WIDTH = 560;

/**
 * Share of the viewport a container must cover before the viewer treats the screen as its own:
 * it may then reach into the safe areas and keep hold of touch gestures. Anything smaller is an
 * embed inside someone else's scrolling page.
 */
const FULL_BLEED_WIDTH_RATIO = 0.92;
const FULL_BLEED_HEIGHT_RATIO = 0.75;

function matchesMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** The primary pointer is a finger or a stylus: bigger targets, and nothing may depend on hover. */
export function hasCoarsePointer(): boolean {
  return matchesMedia('(pointer: coarse)');
}

/** The visitor asked for less motion, so camera moves should land instead of travelling. */
export function prefersReducedMotion(): boolean {
  return matchesMedia('(prefers-reduced-motion: reduce)');
}

/** `duration` unless the visitor asked for less motion, in which case none. */
export function motionDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}

/** Whether `container` covers enough of the viewport to count as the whole screen. */
export function isFullBleed(container: HTMLElement): boolean {
  const view = container.ownerDocument.defaultView;
  if (view === null) return false;
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return (
    rect.width >= view.innerWidth * FULL_BLEED_WIDTH_RATIO &&
    rect.height >= view.innerHeight * FULL_BLEED_HEIGHT_RATIO
  );
}

/**
 * Breathing room Sigma leaves around the graph when it frames it. A fixed 48px costs a quarter
 * of a phone's width, so it shrinks with the container and stops at a value that still keeps the
 * outermost labels off the edge.
 */
export function stagePaddingFor(width: number): number {
  if (width <= 0) return 48;
  return Math.round(Math.min(48, Math.max(16, width * 0.09)));
}
