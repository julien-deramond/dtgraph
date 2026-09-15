import { writeFile } from 'node:fs/promises';

import { renderTokenGraphToSvg } from '@dtgraph/core';
import type { Command } from 'commander';

import {
  loadAndResolveTokenFiles,
  parseContextOptions,
  readTokenFiles,
  type LoadTokenGraphOptions,
  type TokenFileInput,
} from '../token-graph.js';

export interface RenderCommandOptions {
  output?: string;
  context?: string[];
}

/** Parse, resolve, and render one or more DTCG token file contents to an SVG string. */
export function renderTokenFilesToSvg(
  files: TokenFileInput[],
  options: LoadTokenGraphOptions = {},
): string {
  return renderTokenGraphToSvg(loadAndResolveTokenFiles(files, options).graph);
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description(
      'Render one or more DTCG token files (optionally driven by a resolver) to an SVG token graph',
    )
    .argument('<files...>', 'DTCG token JSON file(s) to render, plus at most one resolver document')
    .option('-o, --output <file>', 'write the SVG to this file instead of stdout')
    .option(
      '-c, --context <modifier=context>',
      'with a resolver: select a modifier context (repeatable, or comma-separated)',
      collect,
    )
    .action(async (files: string[], options: RenderCommandOptions) => {
      const context = parseContextOptions(options.context ?? []);
      const svg = renderTokenFilesToSvg(await readTokenFiles(files), { context });
      if (options.output !== undefined) {
        await writeFile(options.output, svg, 'utf8');
      } else {
        process.stdout.write(`${svg}\n`);
      }
    });
}
