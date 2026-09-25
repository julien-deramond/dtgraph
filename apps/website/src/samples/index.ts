import resolver from '@deramond.dev/tokens/brand.resolver.json';
import border from '@deramond.dev/tokens/tokens/border.json';
import colorPrimitive from '@deramond.dev/tokens/tokens/color.primitive.json';
import colorSemantic from '@deramond.dev/tokens/tokens/color.semantic.json';
import layout from '@deramond.dev/tokens/tokens/layout.json';
import motion from '@deramond.dev/tokens/tokens/motion.json';
import radius from '@deramond.dev/tokens/tokens/radius.json';
import space from '@deramond.dev/tokens/tokens/space.json';
import typography from '@deramond.dev/tokens/tokens/typography.json';

import designSystem from './design-system.json';

export interface Sample {
  id: string;
  label: string;
  files: { source: string; content: string }[];
}

const file = (source: string, json: unknown) => ({ source, content: JSON.stringify(json) });

/** A made-up design system, big enough to show off the map. The page lands on it. */
export const GENERIC: Sample = {
  id: 'generic',
  label: 'Sample',
  files: [file('design-system.json', designSystem)],
};

/**
 * The tokens this site is styled with (@deramond.dev/tokens, through @deramond.dev/astro): a
 * real DTCG resolver and the files it references, matched by file name as when they are dropped.
 */
export const THIS_SITE: Sample = {
  id: 'this-site',
  label: "This site's tokens",
  files: [
    file('brand.resolver.json', resolver),
    file('color.primitive.json', colorPrimitive),
    file('color.semantic.json', colorSemantic),
    file('typography.json', typography),
    file('space.json', space),
    file('radius.json', radius),
    file('border.json', border),
    file('layout.json', layout),
    file('motion.json', motion),
  ],
};

export const SAMPLES: Sample[] = [GENERIC, THIS_SITE];
