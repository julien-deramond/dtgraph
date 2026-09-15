import { createRequire } from 'node:module';

import { Command } from 'commander';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string; description: string };

/**
 * Build the `dtgraph` CLI's root command, with its name/description/version wired up from
 * `package.json`. Subcommands (`render`, `validate`) are registered on this by later work.
 */
export function createProgram(): Command {
  const program = new Command();
  program.name('dtgraph').description(packageJson.description).version(packageJson.version);
  return program;
}
