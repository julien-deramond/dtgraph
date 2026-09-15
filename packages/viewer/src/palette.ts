/**
 * Categorical palettes for coloring nodes by group or type. Both are ordered so that adjacent
 * entries contrast (no two neighboring hues), and each is tuned for its canvas: the dark palette
 * uses light, saturated tints that glow on near-black; the light palette uses deeper shades that
 * hold up on white.
 */
export const DARK_PALETTE: readonly string[] = [
  '#60a5fa', // blue
  '#f472b6', // pink
  '#4ade80', // green
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#a3e635', // lime
  '#38bdf8', // sky
  '#f87171', // red
  '#facc15', // yellow
  '#818cf8', // indigo
  '#34d399', // emerald
  '#fb7185', // rose
  '#22d3ee', // cyan
  '#c084fc', // purple
  '#fde047', // yellow-300
  '#5eead4', // teal-300
  '#93c5fd', // blue-300
];

export const LIGHT_PALETTE: readonly string[] = [
  '#2563eb', // blue
  '#db2777', // pink
  '#16a34a', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#0d9488', // teal
  '#ea580c', // orange
  '#c026d3', // fuchsia
  '#65a30d', // lime
  '#0284c7', // sky
  '#dc2626', // red
  '#ca8a04', // yellow
  '#4f46e5', // indigo
  '#059669', // emerald
  '#e11d48', // rose
  '#0891b2', // cyan
  '#9333ea', // purple
  '#a16207', // yellow-700
  '#0f766e', // teal-700
  '#1d4ed8', // blue-700
];

/**
 * Assign a palette color to every distinct key. Keys are sorted first, so the mapping depends only
 * on the *set* of keys, not on the order they were encountered in — two renders of the same
 * token set always agree on colors. Palettes cycle when there are more keys than colors.
 */
export function assignCategoryColors(
  keys: Iterable<string>,
  palette: readonly string[],
): Map<string, string> {
  const sorted = Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
  const colors = new Map<string, string>();
  sorted.forEach((key, index) => {
    colors.set(key, palette[index % palette.length]);
  });
  return colors;
}

function parseHex(color: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (match === null) return undefined;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function toHex(channel: number): string {
  return Math.round(Math.max(0, Math.min(255, channel)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Blend `color` toward `background`, keeping `amount` of the original (1 = unchanged, 0 = the
 * background). Returns an opaque `#rrggbb`: Sigma's WebGL programs ignore alpha, so "fading" a
 * node or edge means pre-mixing it with the canvas color. Non-hex inputs are returned unchanged.
 */
export function fadeTowards(color: string, background: string, amount: number): string {
  const from = parseHex(color);
  const to = parseHex(background);
  if (from === undefined || to === undefined) return color;
  const t = Math.max(0, Math.min(1, amount));
  return `#${from.map((channel, i) => toHex(to[i] + (channel - to[i]) * t)).join('')}`;
}
