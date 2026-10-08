import { describe, expect, it } from 'vitest';

import { resolveValue, swatchColor } from '../src/resolve-value.js';
import { SAMPLE, tokenGraphFrom } from './helpers.js';

describe('resolveValue', () => {
  const graph = tokenGraphFrom(SAMPLE);

  it('follows a plain alias chain to its literal', () => {
    expect(resolveValue(graph, ['button', 'background'])).toEqual({
      value: '#3b82f6',
      from: 'color.blue',
      complete: true,
    });
  });

  it('returns a literal token as-is', () => {
    expect(resolveValue(graph, ['spacing', 'md'])).toEqual({
      value: { value: 1, unit: 'rem' },
      from: 'spacing.md',
      complete: true,
    });
  });

  it('leaves composite values alone', () => {
    const result = resolveValue(graph, ['button', 'border']);
    expect(result.from).toBe('button.border');
    expect(result.value).toMatchObject({ color: '{color.gray}' });
  });

  it('stops on an unknown token without throwing', () => {
    // Core rejects dangling aliases at resolution time, so fake one at the lookup level.
    const graph = tokenGraphFrom({ a: { $value: 1 } });
    const dangling = {
      ...graph,
      getNode: (path: string[]) =>
        path.join('.') === 'a' ? { ...graph.nodes[0], value: '{nope}' } : undefined,
    };
    expect(resolveValue(dangling, ['a'])).toEqual({ value: '{nope}', from: 'a', complete: false });
  });
});

describe('swatchColor', () => {
  it('shows a swatch for resolved color strings and hex-bearing color objects only', () => {
    expect(swatchColor('color', '#123456')).toBe('#123456');
    expect(swatchColor('color', { colorSpace: 'srgb', components: [0, 0, 0], hex: '#000' })).toBe(
      '#000',
    );
    expect(swatchColor('color', { colorSpace: 'srgb', components: [0, 0, 0] })).toBeUndefined();
    expect(swatchColor('color', '{color.brand}')).toBeUndefined();
    expect(swatchColor('dimension', '#123456')).toBeUndefined();
  });

  it('never returns a value that could load a resource', () => {
    for (const value of [
      'url(https://host/x.png)',
      ' URL( "https://host/x.png" )',
      'image-set("https://host/x.png" 1x)',
      '-webkit-image-set(url(x.png) 1x)',
      'var(--x)',
      'u\\72l(https://host/x.png)',
    ]) {
      expect(swatchColor('color', value)).toBeUndefined();
      expect(swatchColor('color', { hex: value })).toBeUndefined();
    }
    expect(swatchColor('color', 'rgb(1 2 3)')).toBe('rgb(1 2 3)');
    expect(swatchColor('color', 'color-mix(in srgb, red 50%, blue)')).toBe(
      'color-mix(in srgb, red 50%, blue)',
    );
  });
});
