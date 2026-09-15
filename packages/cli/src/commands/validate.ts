import { DtcgParseError } from '@dtgraph/core';
import type { Command } from 'commander';

import { loadAndResolveTokenFiles, readTokenFiles, type TokenFileInput } from '../token-graph.js';

export interface ValidateResult {
  ok: boolean;
  files: string[];
  tokenCount?: number;
  edgeCount?: number;
  error?: {
    message: string;
    path?: string[];
    specReference?: string;
  };
}

/** Parse, resolve, and cycle-check one or more DTCG token file contents, without producing output. */
export function validateTokenFiles(files: TokenFileInput[]): ValidateResult {
  const sources = files.map((file) => file.source);
  try {
    const graph = loadAndResolveTokenFiles(files);
    return {
      ok: true,
      files: sources,
      tokenCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  } catch (error) {
    if (error instanceof DtcgParseError) {
      return {
        ok: false,
        files: sources,
        error: { message: error.message, path: error.path, specReference: error.specReference },
      };
    }
    return {
      ok: false,
      files: sources,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export interface ValidateCommandOptions {
  json?: boolean;
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate that DTCG token file(s) parse and all aliases resolve, including cycles')
    .argument('<files...>', 'DTCG token JSON file(s) to validate')
    .option('--json', 'print a machine-readable JSON result instead of a human-readable summary')
    .action(async (files: string[], options: ValidateCommandOptions) => {
      const result = validateTokenFiles(await readTokenFiles(files));

      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (result.ok) {
        console.log(
          `✓ ${result.files.length} file(s) valid — ${result.tokenCount} token(s), ${result.edgeCount} edge(s)`,
        );
      } else {
        console.error(`✗ ${result.error?.message}`);
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    });
}
