import { EdgeArrowProgram, EdgeLineProgram, NodeCircleProgram } from 'sigma/rendering';
import type { Settings } from 'sigma/settings';
import type { EdgeDisplayData, NodeDisplayData, PartialButFor } from 'sigma/types';

import type { ViewerEdgeAttributes, ViewerGraph, ViewerNodeAttributes } from './build-graph.js';
import { fadeTowards } from './palette.js';
import type { ThemeColors } from './theme.js';

export type ViewerSettings = Settings<ViewerNodeAttributes, ViewerEdgeAttributes>;

type LabelData = PartialButFor<NodeDisplayData, 'x' | 'y' | 'size' | 'label' | 'color'>;

/**
 * Mutable interaction state the Sigma reducers read on every frame. Kept as a plain object (not
 * closed-over `let`s) so the mount code can update it and just ask Sigma to refresh.
 */
export interface InteractionState {
  hovered: string | null;
  /** The hovered node plus its direct neighbors in both directions. */
  neighborhood: Set<string>;
}

export function createInteractionState(): InteractionState {
  return { hovered: null, neighborhood: new Set() };
}

/** Font size for a label: grows with the node's rendered size (like Gephi), within sane bounds. */
export function labelFontSize(nodeSize: number, baseSize: number): number {
  return Math.max(baseSize, Math.min(baseSize * 2.4, nodeSize * 1.2));
}

function labelPosition(data: LabelData, fontSize: number): { x: number; y: number } {
  return { x: data.x + data.size + 4, y: data.y + fontSize / 3 };
}

/** Label with a halo stroke, so text stays readable over the edge texture and neighboring dots. */
export function createLabelDrawer(theme: ThemeColors): ViewerSettings['defaultDrawNodeLabel'] {
  return (context, data, settings) => {
    if (!data.label) return;
    const fontSize = labelFontSize(data.size, settings.labelSize);
    const { x, y } = labelPosition(data, fontSize);
    context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
    context.lineJoin = 'round';
    context.lineWidth = Math.max(2.5, fontSize / 4);
    context.strokeStyle = theme.labelHalo;
    context.strokeText(data.label, x, y);
    context.fillStyle = theme.label;
    context.fillText(data.label, x, y);
  };
}

/** Hovered node: a thin ring in the node's own color plus its label, forced visible. */
export function createHoverDrawer(theme: ThemeColors): ViewerSettings['defaultDrawNodeHover'] {
  const drawLabel = createLabelDrawer(theme);
  return (context, data, settings) => {
    context.beginPath();
    context.arc(data.x, data.y, data.size + 3, 0, Math.PI * 2);
    context.closePath();
    context.lineWidth = 2;
    context.strokeStyle = theme.hoverRing;
    context.stroke();
    drawLabel(context, data, settings);
  };
}

/**
 * Sigma settings for the viewer. Reducers implement hover focus: with a node hovered, everything
 * outside its neighborhood fades to near-transparent and loses its label, so the neighborhood
 * pops without any DOM work.
 */
export function createSigmaSettings(
  graph: ViewerGraph,
  theme: ThemeColors,
  state: InteractionState,
): Partial<ViewerSettings> {
  return {
    // Rendering programs
    defaultNodeType: 'circle',
    nodeProgramClasses: { circle: NodeCircleProgram },
    defaultEdgeType: 'arrow',
    edgeProgramClasses: { arrow: EdgeArrowProgram, line: EdgeLineProgram },
    minEdgeThickness: 0.6,
    zIndex: true,

    // Labels
    renderEdgeLabels: false,
    labelFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    labelSize: 12,
    labelWeight: '500',
    labelColor: { color: theme.label },
    labelRenderedSizeThreshold: 4,
    labelDensity: 1,
    labelGridCellSize: 60,
    defaultDrawNodeLabel: createLabelDrawer(theme),
    defaultDrawNodeHover: createHoverDrawer(theme),

    // Camera: ratio < 1 is zoomed in. Allow deep zoom into dense clusters, modest zoom out.
    minCameraRatio: 0.005,
    maxCameraRatio: 2.5,
    stagePadding: 48,
    zoomingRatio: 1.5,
    doubleClickZoomingRatio: 2.5,

    nodeReducer: (node, data): Partial<NodeDisplayData> => {
      if (state.hovered === null) return data;
      if (state.neighborhood.has(node)) {
        return { ...data, zIndex: data.zIndex + 1_000_000, forceLabel: true };
      }
      return {
        ...data,
        color: fadeTowards(data.color, theme.background, theme.fadedNodeStrength),
        label: null,
      };
    },
    edgeReducer: (edge, data): Partial<EdgeDisplayData> => {
      if (state.hovered === null) {
        return { ...data, color: fadeTowards(data.color, theme.background, theme.edgeStrength) };
      }
      const [source, target] = graph.extremities(edge);
      const inFocus = source === state.hovered || target === state.hovered;
      if (inFocus) return { ...data, size: 1.6, zIndex: 1 };
      return {
        ...data,
        color: fadeTowards(data.color, theme.background, theme.fadedEdgeStrength),
      };
    },
  };
}
