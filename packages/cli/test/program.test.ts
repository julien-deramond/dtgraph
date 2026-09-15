import { describe, expect, it } from 'vitest';

import { createProgram } from '../src/program.js';

describe('createProgram', () => {
  it('wires up the program name, description, and version from package.json', () => {
    const program = createProgram();
    expect(program.name()).toBe('dtgraph');
    expect(program.description().length).toBeGreaterThan(0);
    expect(program.version()).toBe('0.0.0');
  });

  it('includes the program name and description in --help output', () => {
    const program = createProgram();
    const help = program.helpInformation();
    expect(help).toContain('dtgraph');
    expect(help).toContain(program.description());
  });
});
