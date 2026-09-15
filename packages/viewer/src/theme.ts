import { DARK_PALETTE, LIGHT_PALETTE } from './palette.js';

export type ViewerTheme = 'dark' | 'light';

/** Canvas-side colors for a theme. The matching CSS lives in `style.css` (`[data-theme]`). */
export interface ThemeColors {
  background: string;
  label: string;
  /** Stroke painted behind label text so it stays legible over edges and other nodes. */
  labelHalo: string;
  /** Ring drawn around the hovered node. */
  hoverRing: string;
  /**
   * How much of an edge's own color survives at rest (the rest is background): edges should
   * read as texture, not lines, until you look closer.
   */
  edgeStrength: number;
  /** Same for nodes/edges outside the hovered neighborhood. */
  fadedNodeStrength: number;
  fadedEdgeStrength: number;
  palette: readonly string[];
}

export const THEMES: Record<ViewerTheme, ThemeColors> = {
  dark: {
    background: '#0b0d12',
    label: '#f4f4f5',
    labelHalo: 'rgba(11, 13, 18, 0.85)',
    hoverRing: '#ffffff',
    edgeStrength: 0.3,
    fadedNodeStrength: 0.12,
    fadedEdgeStrength: 0.05,
    palette: DARK_PALETTE,
  },
  light: {
    background: '#f8f8fa',
    label: '#18181b',
    labelHalo: 'rgba(248, 248, 250, 0.9)',
    hoverRing: '#18181b',
    edgeStrength: 0.35,
    fadedNodeStrength: 0.15,
    fadedEdgeStrength: 0.06,
    palette: LIGHT_PALETTE,
  },
};
