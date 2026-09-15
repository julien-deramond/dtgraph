/** A node in a parsed DTCG token tree that represents a single token. */
export interface TokenNode {
  kind: 'token';
  /** The key this token was declared under (empty string only for a root-level token). */
  name: string;
  /** Group names from the document root down to (and including) this token. */
  path: string[];
  /** The raw, unresolved `$value` (may contain `{alias.references}`). */
  value: unknown;
  /** Own `$type`, or the nearest ancestor group's `$type` if not declared here. */
  type?: string;
  description?: string;
  extensions?: Record<string, unknown>;
  /** Identifier (e.g. file path) of the source document this token was parsed from, for callers merging multiple files. */
  source?: string;
}

/** A node in a parsed DTCG token tree that groups other tokens/groups. */
export interface GroupNode {
  kind: 'group';
  /** The key this group was declared under (empty string for the document root). */
  name: string;
  /** Group names from the document root down to (and including) this group. */
  path: string[];
  /** Own `$type`, as declared on this group (not inherited). */
  type?: string;
  description?: string;
  extensions?: Record<string, unknown>;
  children: Record<string, TokenTreeNode>;
}

export type TokenTreeNode = TokenNode | GroupNode;

/** A graph edge produced by resolving a `{group.path.to.token}` alias in a token's `$value`. */
export interface TokenEdge {
  /** Path of the token whose `$value` contains the alias reference. */
  from: string[];
  /** Path of the token the alias reference resolves to. */
  to: string[];
  /** The raw, unresolved alias reference, e.g. `"{color.brand}"`. */
  reference: string;
  /**
   * Whether this edge came from a scalar `$value` alias (`"alias"`) or from one member of a
   * composite `$value` object (`"composite-member"`). Optional for now — set by whichever
   * resolver produced the edge; a scalar-only resolver may omit it.
   */
  kind?: 'alias' | 'composite-member';
  /** For `kind: "composite-member"` edges, which member of the composite value the alias came from (e.g. `"color"` on a `shadow` token). */
  member?: string;
}

/**
 * A fully resolved token graph: every parsed token plus the alias edges between them.
 * Built by merging one or more parsed token trees and resolving their aliases — see the
 * `resolveAliasEdges` (and, once available, cross-file merge) functions that produce one.
 */
export interface TokenGraph {
  nodes: TokenNode[];
  edges: TokenEdge[];
  /** Look up a token node by its path (e.g. `["color", "brand"]`). */
  getNode(path: string[]): TokenNode | undefined;
  /** Edges whose `from` is this path — the aliases this token references. */
  getOutgoingEdges(path: string[]): TokenEdge[];
  /** Edges whose `to` is this path — the tokens that alias this one. */
  getIncomingEdges(path: string[]): TokenEdge[];
}

// ---- DTCG primitive `$value` shapes (spec 2025.10, section 8) ----

/** A `{group.path}`-style alias reference, as it appears unresolved in a raw `$value`. */
export type AliasReference = `{${string}}`;

/** A value that may be given directly, or as an alias reference to another token of the same type. */
export type Aliasable<T> = T | AliasReference;

/**
 * `$value` shape for `$type: "color"` per the DTCG Color module (colorSpace + components,
 * with optional alpha/hex). Plain hex strings (`"#112233"`) are also accepted here for
 * compatibility with the simpler color values commonly seen in existing DTCG files.
 */
export interface ColorObjectValue {
  colorSpace: string;
  components: Aliasable<number>[];
  alpha?: Aliasable<number>;
  hex?: string;
}
export type ColorValue = ColorObjectValue | string;

/** `$value` shape for `$type: "dimension"`. */
export interface DimensionValue {
  value: Aliasable<number>;
  unit: 'px' | 'rem';
}

/** `$value` shape for `$type: "fontFamily"`: a single font name, or an ordered fallback list. */
export type FontFamilyValue = Aliasable<string> | Aliasable<string>[];

/** Pre-defined `$type: "fontWeight"` string keywords. */
export type FontWeightKeyword =
  | 'thin'
  | 'hairline'
  | 'extra-light'
  | 'ultra-light'
  | 'light'
  | 'normal'
  | 'regular'
  | 'book'
  | 'medium'
  | 'semi-bold'
  | 'demi-bold'
  | 'bold'
  | 'extra-bold'
  | 'ultra-bold'
  | 'black'
  | 'heavy'
  | 'extra-black'
  | 'ultra-black';

/** `$value` shape for `$type: "fontWeight"`: a number in `[1, 1000]`, or a pre-defined keyword. */
export type FontWeightValue = number | FontWeightKeyword;

/** `$value` shape for `$type: "duration"`. */
export interface DurationValue {
  value: Aliasable<number>;
  unit: 'ms' | 's';
}

/** `$value` shape for `$type: "cubicBezier"`: `[P1x, P1y, P2x, P2y]`. */
export type CubicBezierValue = [number, number, number, number];

/** `$value` shape for `$type: "number"`. */
export type NumberValue = number;

// ---- DTCG composite `$value` shapes (spec 2025.10, section 9) ----

/** Pre-defined `$type: "strokeStyle"` string keywords. */
export type StrokeStyleKeyword =
  'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset';

export interface StrokeStyleObjectValue {
  dashArray: Aliasable<DimensionValue>[];
  lineCap: 'round' | 'butt' | 'square';
}

/** `$value` shape for `$type: "strokeStyle"`. */
export type StrokeStyleValue = StrokeStyleKeyword | StrokeStyleObjectValue;

/** `$value` shape for `$type: "border"`. */
export interface BorderValue {
  color: Aliasable<ColorValue>;
  width: Aliasable<DimensionValue>;
  style: Aliasable<StrokeStyleValue>;
}

/** `$value` shape for `$type: "transition"`. */
export interface TransitionValue {
  duration: Aliasable<DurationValue>;
  delay: Aliasable<DurationValue>;
  timingFunction: Aliasable<CubicBezierValue>;
}

export interface ShadowObjectValue {
  color: Aliasable<ColorValue>;
  offsetX: Aliasable<DimensionValue>;
  offsetY: Aliasable<DimensionValue>;
  blur: Aliasable<DimensionValue>;
  spread: Aliasable<DimensionValue>;
  /** Inner ("inset") shadow rather than a drop/box shadow. Defaults to `false`. */
  inset?: boolean;
}

/** `$value` shape for `$type: "shadow"`: a single shadow, or a layered stack of shadows/references. */
export type ShadowValue = ShadowObjectValue | Aliasable<ShadowObjectValue>[];

export interface GradientStopValue {
  color: Aliasable<ColorValue>;
  /** Position along the gradient axis, in `[0, 1]`. */
  position: Aliasable<number>;
}

/** `$value` shape for `$type: "gradient"`: an ordered array of stops and/or references to gradient tokens. */
export type GradientValue = Aliasable<GradientStopValue>[];

/** `$value` shape for `$type: "typography"`. */
export interface TypographyValue {
  fontFamily: Aliasable<FontFamilyValue>;
  fontSize: Aliasable<DimensionValue>;
  fontWeight: Aliasable<FontWeightValue>;
  letterSpacing: Aliasable<DimensionValue>;
  lineHeight: Aliasable<NumberValue>;
}

/** Every DTCG `$type` string this package knows the `$value` shape for. */
export type DtcgType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'strokeStyle'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'typography';
