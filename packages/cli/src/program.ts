import { createRequire } from 'node:module';

import { Command } from 'commander';

import { registerRenderCommand } from './commands/render.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string; description: string };

/**
 * Build the `dtgraph` CLI's root command, with its name/description/version wired up from
 * `package.json` and every subcommand registered.
 */
export function createProgram(): Command {
  const program = new Command();
  program.name('dtgraph').description(packageJson.description).version(packageJson.version);
  registerRenderCommand(program);
  return program;
}
