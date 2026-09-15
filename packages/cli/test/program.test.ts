import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { createProgram } from '../src/program.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

describe('createProgram', () => {
  it('wires up the program name, description, and version from package.json', () => {
    const program = createProgram();
    expect(program.name()).toBe('dtgraph');
    expect(program.description().length).toBeGreaterThan(0);
    expect(program.version()).toBe(packageJson.version);
  });

  it('includes the program name and description in --help output', () => {
    const program = createProgram();
    const help = program.helpInformation();
    expect(help).toContain('dtgraph');
    expect(help).toContain(program.description());
  });
});
