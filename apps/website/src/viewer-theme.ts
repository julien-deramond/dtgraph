/**
 * The map's canvas on the site's tokens: the chrome around it is themed in `styles/viewer.css`,
 * and this is the part CSS can't reach (Sigma paints with WebGL, so it needs real hex values).
 *
 * Categories take the seven illustration hues in their chart order: cyan first, then azure,
 * violet, rose, gold, and the two cyan steps. Seven hues for a few dozen groups means colors
 * repeat; the legend, search and detail panel always name the group.
 */
import { PERMUTATIONS } from '@deramond.dev/tokens';
import { THEMES, type ThemeColors } from '@dtgraph/viewer';

const tokens = PERMUTATIONS['{}'];

function hex(path: string): string {
  const token = tokens[path];
  const value = token?.$type === 'color' ? token.$value.hex : undefined;
  if (value === undefined) throw new Error(`viewer theme: "${path}" is not a hex color token`);
  return value;
}

function rgba(color: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const background = hex('color.bg');

export const viewerTheme: ThemeColors = {
  ...THEMES.dark,
  background,
  label: hex('color.fg'),
  labelHalo: rgba(background, 0.85),
  hoverRing: hex('color.fg'),
  palette: ['cyan', 'azure', 'violet', 'rose', 'gold', 'lift', 'dim'].map((hue) =>
    hex(`color.illustration.${hue}`),
  ),
};
