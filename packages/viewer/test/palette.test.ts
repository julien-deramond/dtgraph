import { describe, expect, it } from 'vitest';

import { assignCategoryColors, DARK_PALETTE, fadeTowards, LIGHT_PALETTE } from '../src/palette.js';

describe('assignCategoryColors', () => {
  it('maps keys to palette colors independently of encounter order', () => {
    const a = assignCategoryColors(['button', 'color', 'spacing'], DARK_PALETTE);
    const b = assignCategoryColors(['spacing', 'button', 'color', 'button'], DARK_PALETTE);
    expect(a).toEqual(b);
    expect(a.get('button')).toBe(DARK_PALETTE[0]);
    expect(a.get('color')).toBe(DARK_PALETTE[1]);
    expect(a.get('spacing')).toBe(DARK_PALETTE[2]);
  });

  it('cycles the palette when there are more keys than colors', () => {
    const keys = Array.from({ length: DARK_PALETTE.length + 2 }, (_, i) =>
      String(i).padStart(3, '0'),
    );
    const colors = assignCategoryColors(keys, DARK_PALETTE);
    expect(colors.get(keys[DARK_PALETTE.length])).toBe(DARK_PALETTE[0]);
    expect(colors.get(keys[DARK_PALETTE.length + 1])).toBe(DARK_PALETTE[1]);
  });

  it('ships palettes of equal length with only hex colors', () => {
    expect(DARK_PALETTE.length).toBe(LIGHT_PALETTE.length);
    for (const color of [...DARK_PALETTE, ...LIGHT_PALETTE]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('fadeTowards', () => {
  it('mixes a color toward the background by the given amount', () => {
    expect(fadeTowards('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(fadeTowards('#ff0080', '#000000', 1)).toBe('#ff0080');
    expect(fadeTowards('#ff0080', '#102030', 0)).toBe('#102030');
  });

  it('clamps the amount and leaves non-hex input untouched', () => {
    expect(fadeTowards('#ffffff', '#000000', 2)).toBe('#ffffff');
    expect(fadeTowards('rebeccapurple', '#000000', 0.5)).toBe('rebeccapurple');
  });
});
