import { DtcgParseError } from '@dtgraph/core';
import type { Command } from 'commander';

import {
  describeContextHint,
  loadAndResolveTokenFiles,
  parseContextOptions,
  readTokenFiles,
  type LoadTokenGraphOptions,
  type TokenFileInput,
} from '../token-graph.js';

export interface ValidateResult {
  ok: boolean;
  files: string[];
  tokenCount?: number;
  edgeCount?: number;
  /** Set when one of the files was a resolver document: which one, and the contexts applied. */
  resolver?: {
    source: string;
    contexts: Record<string, string>;
  };
  error?: {
    message: string;
    path?: string[];
    specReference?: string;
    /** What to change to make this run succeed, when the failure has an obvious remedy. */
    hint?: string;
  };
}

/** Parse, resolve, and cycle-check one or more DTCG token file contents, without producing output. */
export function validateTokenFiles(
  files: TokenFileInput[],
  options: LoadTokenGraphOptions = {},
): ValidateResult {
  const sources = files.map((file) => file.source);
  try {
    const { graph, resolver } = loadAndResolveTokenFiles(files, options);
    return {
      ok: true,
      files: sources,
      tokenCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      ...(resolver === undefined
        ? {}
        : { resolver: { source: resolver.source, contexts: resolver.contexts } }),
    };
  } catch (error) {
    if (error instanceof DtcgParseError) {
      const hint = describeContextHint(error);
      return {
        ok: false,
        files: sources,
        error: {
          message: error.message,
          path: error.path,
          specReference: error.specReference,
          ...(hint === undefined ? {} : { hint }),
        },
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
  context?: string[];
}

/** One-line human-readable summary of a successful validation. */
export function formatValidateSummary(result: ValidateResult): string {
  let summary = `✓ ${result.files.length} file(s) valid — ${result.tokenCount} token(s), ${result.edgeCount} edge(s)`;
  if (result.resolver !== undefined) {
    const contexts = Object.entries(result.resolver.contexts).map(
      ([modifier, context]) => `${modifier}=${context}`,
    );
    summary += ` · resolver ${result.resolver.source}`;
    if (contexts.length > 0) summary += ` · ${contexts.join(', ')}`;
  }
  return summary;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate that DTCG token file(s) parse and all aliases resolve, including cycles')
    .argument(
      '<files...>',
      'DTCG token JSON file(s) to validate, plus at most one resolver document',
    )
    .option('--json', 'print a machine-readable JSON result instead of a human-readable summary')
    .option(
      '-c, --context <modifier=context>',
      'with a resolver: select a modifier context (repeatable, or comma-separated)',
      collect,
    )
    .action(async (files: string[], options: ValidateCommandOptions) => {
      let result: ValidateResult;
      try {
        result = validateTokenFiles(await readTokenFiles(files), {
          context: parseContextOptions(options.context ?? []),
        });
      } catch (error) {
        result = {
          ok: false,
          files,
          error: { message: error instanceof Error ? error.message : String(error) },
        };
      }

      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (result.ok) {
        console.log(formatValidateSummary(result));
      } else {
        console.error(`✗ ${result.error?.message}`);
        if (result.error?.hint !== undefined) console.error(result.error.hint);
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    });
}
