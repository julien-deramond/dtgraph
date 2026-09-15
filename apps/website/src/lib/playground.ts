import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  renderTokenGraphToSvg,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import type { NamedTokenTree } from '@dtgraph/core';

import { checkGraphComplexity, checkUploadComplexity } from './upload-guard.js';

export interface PlaygroundFileInput {
  /** File name, used as the `source` tag for cross-file collision/error messages. */
  source: string;
  content: string;
}

/**
 * Parse, resolve (across all given files), and render DTCG token file contents to an SVG
 * string — entirely in-memory, no network I/O. Errors from JSON parsing, DTCG parsing, alias
 * resolution, or cycle detection propagate unmodified, so callers can surface core's own
 * message rather than a generic one. Size/complexity caps (see `upload-guard.ts`) are enforced
 * first, since this input is fully attacker-controlled.
 */
export function renderTokenFilesToSvg(files: PlaygroundFileInput[]): string {
  checkUploadComplexity(files);

  const namedTrees: NamedTokenTree[] = files.map(({ source, content }) => ({
    source,
    tree: parseTokenTree(JSON.parse(content) as unknown),
  }));
  const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
  const edges = resolveAliasEdgesAcrossFiles(namedTrees);
  checkGraphComplexity(nodes.length, edges.length);

  return renderTokenGraphToSvg(buildTokenGraph(nodes, edges));
}

/** Read a `FileList`/`File[]` (from an `<input type="file">` or a drop event) via the browser File API. */
export async function readFiles(files: FileList | File[]): Promise<PlaygroundFileInput[]> {
  return Promise.all(
    Array.from(files).map(async (file) => ({ source: file.name, content: await file.text() })),
  );
}

export interface PlaygroundElements {
  output: HTMLElement;
  error: HTMLElement;
}

/**
 * Render the given file contents into `els.output` (as SVG markup — safe because
 * `renderTokenGraphToSvg` escapes every piece of token-derived text before returning) or, on
 * failure, show the error's message as plain text in `els.error`.
 */
export function renderFilesToDom(files: PlaygroundFileInput[], els: PlaygroundElements): void {
  els.error.textContent = '';
  els.output.innerHTML = '';
  try {
    els.output.innerHTML = renderTokenFilesToSvg(files);
  } catch (error) {
    els.error.textContent = error instanceof Error ? error.message : String(error);
  }
}
