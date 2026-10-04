import { writeFile } from 'node:fs/promises';

import { renderTokenGraphToMermaid, renderTokenGraphToSvg } from '@dtgraph/core';
import { Option, type Command } from 'commander';

import {
  loadAndResolveTokenFiles,
  parseContextOptions,
  readTokenFiles,
  type LoadTokenGraphOptions,
  type TokenFileInput,
} from '../token-graph.js';

/** Output formats `dtgraph render --format` accepts. */
export const RENDER_FORMATS = ['svg', 'mermaid'] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

export interface RenderCommandOptions {
  output?: string;
  context?: string[];
  format?: RenderFormat;
  fence?: boolean;
  fullPaths?: boolean;
}

export interface RenderMermaidOptions extends LoadTokenGraphOptions {
  /** Label nodes with their full dotted path instead of their last path segment. */
  fullPaths?: boolean;
  /** Wrap the diagram in a fenced ```` ```mermaid ```` block, ready to paste into Markdown. */
  fence?: boolean;
}

/** Parse, resolve, and render one or more DTCG token file contents to an SVG string. */
export function renderTokenFilesToSvg(
  files: TokenFileInput[],
  options: LoadTokenGraphOptions = {},
): string {
  return renderTokenGraphToSvg(loadAndResolveTokenFiles(files, options).graph);
}

/** Parse, resolve, and render one or more DTCG token file contents to Mermaid flowchart text. */
export function renderTokenFilesToMermaid(
  files: TokenFileInput[],
  options: RenderMermaidOptions = {},
): string {
  const mermaid = renderTokenGraphToMermaid(loadAndResolveTokenFiles(files, options).graph, {
    fullPaths: options.fullPaths,
  });
  return options.fence === true ? `\`\`\`mermaid\n${mermaid}\n\`\`\`` : mermaid;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description(
      'Render one or more DTCG token files (optionally driven by a resolver) to an SVG token graph, or to Mermaid text',
    )
    .argument('<files...>', 'DTCG token JSON file(s) to render, plus at most one resolver document')
    .option('-o, --output <file>', 'write the output to this file instead of stdout')
    .option(
      '-c, --context <modifier=context>',
      'with a resolver: select a modifier context (repeatable, or comma-separated)',
      collect,
    )
    .addOption(
      new Option('--format <format>', 'output format').choices(RENDER_FORMATS).default('svg'),
    )
    .option('--fence', 'with --format mermaid: wrap the diagram in a ```mermaid code fence')
    .option(
      '--full-paths',
      'with --format mermaid: label nodes with their full token path, not the last segment',
    )
    .action(async (files: string[], options: RenderCommandOptions) => {
      const format = options.format ?? 'svg';
      if (format !== 'mermaid') {
        const mermaidOnly = [
          options.fence === true && '--fence',
          options.fullPaths === true && '--full-paths',
        ].filter((flag): flag is string => flag !== false);
        if (mermaidOnly.length > 0) {
          const verb = mermaidOnly.length > 1 ? 'apply' : 'applies';
          throw new Error(`${mermaidOnly.join(' and ')} only ${verb} with --format mermaid`);
        }
      }

      const context = parseContextOptions(options.context ?? []);
      const tokenFiles = await readTokenFiles(files);
      const output =
        format === 'mermaid'
          ? renderTokenFilesToMermaid(tokenFiles, {
              context,
              fence: options.fence,
              fullPaths: options.fullPaths,
            })
          : renderTokenFilesToSvg(tokenFiles, { context });
      if (options.output !== undefined) {
        await writeFile(options.output, output, 'utf8');
      } else {
        process.stdout.write(`${output}\n`);
      }
    });
}
