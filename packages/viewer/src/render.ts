import { EdgeArrowProgram, EdgeLineProgram, NodeCircleProgram } from 'sigma/rendering';
import type { Settings } from 'sigma/settings';
import type { EdgeDisplayData, NodeDisplayData, PartialButFor } from 'sigma/types';

import type { ViewerEdgeAttributes, ViewerGraph, ViewerNodeAttributes } from './build-graph.js';
import {
  edgeEmphasis,
  type InteractionState,
  isAnchored,
  LIT_EDGE_THICKNESS,
  nodeEmphasis,
} from './emphasis.js';
import {
  LABEL_FONT_STACK,
  LABEL_GRID_CELL_SIZE,
  LABEL_SIZE,
  labelFontSize,
  labelOffset,
} from './labels.js';
import { fadeTowards } from './palette.js';
import type { ThemeColors } from './theme.js';

export type ViewerSettings = Settings<ViewerNodeAttributes, ViewerEdgeAttributes>;

type LabelData = PartialButFor<NodeDisplayData, 'x' | 'y' | 'size' | 'label' | 'color'>;

/**
 * Pixels added to every token dot's radius where the pointer is a finger. Sigma hit-tests the
 * pixels it actually drew, so a 3px primitive is a 6px target.
 *
 * Added rather than multiplied, because the scale is `base + 2.6 * sqrt(dependents)`: a constant
 * moves the floor exactly like `baseNodeSize` already does for small graphs, and leaves the
 * differences between dots — the blast radius the map is about — where they were. Multiplying
 * stretches the top of the scale into overlapping blobs.
 *
 * Small, because it is the wrong tool past a point: in a 500-token hairball every dot in the core
 * is small, and lifting them enough to hit at rest closes the gaps that make the cluster readable.
 * What actually makes a crowded map tappable is zooming into it, which grows the dots anyway. So
 * this buys the sparse and mid-sized graphs — where dots stand alone and a tap is a real gesture —
 * and leaves the dense ones legible.
 */
export const COARSE_POINTER_NODE_LIFT = 1.5;

export interface SigmaSettingsOptions {
  /** The primary pointer is a finger or stylus: bigger dots and bigger labels. */
  coarsePointer?: boolean;
  /** Breathing room around the framed graph, in pixels. See `stagePaddingFor`. */
  stagePadding?: number;
}

function labelPosition(data: LabelData, fontSize: number): { x: number; y: number } {
  const { dx, dy } = labelOffset(data.size, fontSize);
  return { x: data.x + dx, y: data.y + dy };
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
  options: SigmaSettingsOptions = {},
): Partial<ViewerSettings> {
  const coarse = options.coarsePointer ?? false;
  const nodeLift = coarse ? COARSE_POINTER_NODE_LIFT : 0;
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
    labelFont: LABEL_FONT_STACK,
    labelSize: coarse ? LABEL_SIZE + 1 : LABEL_SIZE,
    labelWeight: '500',
    labelColor: { color: theme.label },
    // Every node is label-eligible (the smallest is 3px); the label grid keeps big graphs tidy.
    labelRenderedSizeThreshold: 3,
    labelDensity: 1,
    labelGridCellSize: coarse ? LABEL_GRID_CELL_SIZE + 12 : LABEL_GRID_CELL_SIZE,
    defaultDrawNodeLabel: createLabelDrawer(theme),
    defaultDrawNodeHover: createHoverDrawer(theme),

    // Camera: ratio < 1 is zoomed in. Allow deep zoom into dense clusters, modest zoom out.
    minCameraRatio: 0.005,
    maxCameraRatio: 2.5,
    stagePadding: options.stagePadding ?? 48,
    zoomingRatio: 1.5,
    doubleClickZoomingRatio: 2.5,

    nodeReducer: (node, data): Partial<NodeDisplayData> => {
      const emphasis = nodeEmphasis(state, node);
      const sized = nodeLift === 0 ? data : { ...data, size: data.size + nodeLift };
      if (emphasis === 'dimmed') {
        return {
          ...sized,
          color: fadeTowards(data.color, theme.background, theme.fadedNodeStrength),
          label: null,
        };
      }
      if (emphasis === 'normal') return sized;
      // Lit: keep the color, draw on top. Labels are forced for the hovered/selected token and
      // its direct neighbors; the wider focus set stays subject to the label grid so a primitive
      // with hundreds of dependents doesn't bury the map in text.
      return {
        ...sized,
        zIndex: data.zIndex + 1_000_000,
        forceLabel: isAnchored(graph, state, node),
        highlighted: node === state.selected && state.hovered === null,
      };
    },
    edgeReducer: (edge, data): Partial<EdgeDisplayData> => {
      const emphasis = edgeEmphasis(graph, state, edge);
      if (emphasis === 'lit') return { ...data, size: LIT_EDGE_THICKNESS, zIndex: 1 };
      const strength = emphasis === 'dimmed' ? theme.fadedEdgeStrength : theme.edgeStrength;
      return { ...data, color: fadeTowards(data.color, theme.background, strength) };
    },
  };
}
