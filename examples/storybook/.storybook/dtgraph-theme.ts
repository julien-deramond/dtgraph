/**
 * The Token Graph panel's WebGL canvas on the same tokens as the manager
 * (@deramond.dev/storybook) and the website (`apps/website/src/viewer-theme.ts`): set as the
 * `dtgraph.theme` parameter in `preview.ts`. The chrome around it is in `dtgraph-chrome.ts`.
 */
import { THEMES, type ThemeColors } from '@dtgraph/viewer';

import { hex, rgba } from './dtgraph-chrome';

export const viewerTheme: ThemeColors = {
  ...THEMES.dark,
  background: hex('bg'),
  label: hex('fg'),
  labelHalo: rgba('bg', 0.85),
  hoverRing: hex('fg'),
  palette: ['cyan', 'azure', 'violet', 'rose', 'gold', 'lift', 'dim'].map((hue) =>
    hex(`illustration.${hue}`),
  ),
};
