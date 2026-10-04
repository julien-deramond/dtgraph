/**
 * Prototype for #139: a deterministic, generated three-tier token set near the playground's
 * 5,000-token cap, to see how the column view holds up at scale without shipping a large real set
 * in the repo. Shaped like real sets: most component tokens alias a semantic token, some skip
 * straight to a primitive, and some carry a literal value.
 */

/** Small deterministic PRNG (mulberry32), so the set is the same on every load. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral',
  'stone', 'brown', 'olive', 'mint', 'navy', 'coral', 'sand', 'plum', 'steel',
]; // prettier-ignore
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const ROLES = ['neutral', 'accent', 'info', 'success', 'warning', 'danger', 'brand', 'muted'];
const SURFACES = ['bg', 'fg', 'border'];
const VARIANTS = ['default', 'subtle', 'strong', 'hover', 'active', 'disabled', 'inverse'];
const PARTS = ['bg', 'fg', 'border', 'icon', 'focus-ring', 'shadow-color'];
const STATES = ['default', 'hover', 'active', 'disabled', 'selected'];
const DIMS = ['padding-x', 'padding-y', 'gap', 'radius', 'border-width', 'min-height'];

type Json = Record<string, unknown>;

function set(root: Json, path: string[], value: unknown): void {
  let node = root;
  for (const key of path.slice(0, -1)) node = (node[key] ??= {}) as Json;
  node[path[path.length - 1]] = value;
}

/** About 4,800 tokens: ~370 core, ~700 semantic, ~3,700 component across 100 components. */
export function syntheticTokenSet(seed = 139): Json {
  const rand = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const doc: Json = {};

  // Core: hue scales and a dimension scale.
  const colors: string[] = [];
  HUES.forEach((hue, h) => {
    STEPS.forEach((step, s) => {
      const lightness = 97 - s * 8.5;
      set(doc, ['color', hue, step], {
        $type: 'color',
        $value: `hsl(${h * 12} 60% ${lightness}%)`,
      });
      colors.push(`color.${hue}.${step}`);
    });
  });
  const sizes: string[] = [];
  for (let i = 0; i <= 40; i++) {
    set(doc, ['size', String(i)], { $type: 'dimension', $value: { value: i * 2, unit: 'px' } });
    sizes.push(`size.${i}`);
  }

  // Semantic: role × surface × variant colors, plus spacing roles.
  const semanticColors: string[] = [];
  for (const role of ROLES) {
    for (const surface of SURFACES) {
      for (const variant of VARIANTS) {
        for (const scheme of ['on-light', 'on-dark', 'contrast', 'high-contrast']) {
          set(doc, [surface, role, variant, scheme], { $value: `{${pick(colors)}}` });
          semanticColors.push(`${surface}.${role}.${variant}.${scheme}`);
        }
      }
    }
  }
  const semanticDims: string[] = [];
  for (const name of ['inset', 'stack', 'inline', 'radius', 'stroke']) {
    for (const scale of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']) {
      set(doc, ['space', name, scale], { $value: `{${pick(sizes)}}` });
      semanticDims.push(`space.${name}.${scale}`);
    }
  }

  // Component: 100 components × parts × states. 70 % alias a semantic token, 15 % skip a tier to a
  // primitive, 15 % are literal.
  for (let c = 0; c < 100; c++) {
    const component = `component-${String(c + 1).padStart(3, '0')}`;
    for (const part of PARTS) {
      for (const state of STATES) {
        const roll = rand();
        const value =
          roll < 0.7
            ? `{${pick(semanticColors)}}`
            : roll < 0.85
              ? `{${pick(colors)}}`
              : { colorSpace: 'srgb', components: [rand(), rand(), rand()], hex: '#808080' };
        set(doc, [component, part, state], { $type: 'color', $value: value });
      }
    }
    for (const dim of DIMS) {
      const roll = rand();
      const value =
        roll < 0.7
          ? `{${pick(semanticDims)}}`
          : roll < 0.85
            ? `{${pick(sizes)}}`
            : { value: Math.round(rand() * 32), unit: 'px' };
      set(doc, [component, dim], { $type: 'dimension', $value: value });
    }
    // One composite per component, aliasing members.
    set(doc, [component, 'focus-shadow'], {
      $type: 'shadow',
      $value: {
        color: `{${pick(semanticColors)}}`,
        offsetX: { value: 0, unit: 'px' },
        offsetY: `{${pick(sizes)}}`,
        blur: `{${pick(sizes)}}`,
        spread: { value: 0, unit: 'px' },
      },
    });
  }
  return doc;
}
