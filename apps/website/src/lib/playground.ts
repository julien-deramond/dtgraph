import {
  buildTokenGraph,
  flattenTokenTree,
  parseTokenTree,
  renderTokenGraphToSvg,
  resolveAliasEdgesAcrossFiles,
} from '@dtgraph/core';
import type { NamedTokenTree, TokenGraph } from '@dtgraph/core';

import { checkGraphComplexity, checkUploadComplexity } from './upload-guard.js';

export interface PlaygroundFileInput {
  /** File name, used as the `source` tag for cross-file collision/error messages. */
  source: string;
  content: string;
}

/**
 * Parse and resolve (across all given files) DTCG token file contents into a `TokenGraph` —
 * entirely in-memory, no network I/O. Errors from JSON parsing, DTCG parsing, alias resolution,
 * or cycle detection propagate unmodified, so callers can surface core's own message rather than
 * a generic one. Size/complexity caps (see `upload-guard.ts`) are enforced first, since this
 * input is fully attacker-controlled.
 */
export function buildTokenGraphFromFiles(files: PlaygroundFileInput[]): TokenGraph {
  checkUploadComplexity(files);

  const namedTrees: NamedTokenTree[] = files.map(({ source, content }) => ({
    source,
    tree: parseTokenTree(JSON.parse(content) as unknown),
  }));
  const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
  const edges = resolveAliasEdgesAcrossFiles(namedTrees);
  checkGraphComplexity(nodes.length, edges.length);

  return buildTokenGraph(nodes, edges);
}

/** Parse, resolve, and render token file contents to the static SVG (the "Export SVG" action). */
export function renderTokenFilesToSvg(files: PlaygroundFileInput[]): string {
  return renderTokenGraphToSvg(buildTokenGraphFromFiles(files));
}

/** Read a `FileList`/`File[]` (from an `<input type="file">` or a drop event) via the browser File API. */
export async function readFiles(files: FileList | File[]): Promise<PlaygroundFileInput[]> {
  return Promise.all(
    Array.from(files).map(async (file) => ({ source: file.name, content: await file.text() })),
  );
}

/** Whatever displays a graph inside the output element; the page passes `@dtgraph/viewer`. */
export type MountGraph = (container: HTMLElement, graph: TokenGraph) => { destroy(): void };

export interface PlaygroundElements {
  /** Where the graph is mounted. */
  output: HTMLElement;
  /** Where failures are reported, as plain text. Hidden while empty. */
  error: HTMLElement;
}

export interface PlaygroundController {
  /** The last successfully loaded graph, if any. */
  readonly graph: TokenGraph | undefined;
  /** The files behind `graph`. */
  readonly files: readonly PlaygroundFileInput[];
  /**
   * Parse, resolve, and show `files`. On failure the error is shown as plain text and whatever
   * was on screen before stays there. Returns whether the load succeeded.
   */
  load(files: PlaygroundFileInput[]): boolean;
  /** Mount the current graph again (after a display option changed). */
  remount(): void;
  /** The static SVG for the current graph, or `undefined` when nothing is loaded. */
  exportSvg(): string | undefined;
  destroy(): void;
}

/**
 * Wire the playground's state machine to the page: `load` swaps the mounted graph on success
 * and reports failures via `textContent` (error messages quote token paths and file names, all
 * untrusted), never through markup.
 */
export function createPlayground(els: PlaygroundElements, mount: MountGraph): PlaygroundController {
  let graph: TokenGraph | undefined;
  let files: PlaygroundFileInput[] = [];
  let mounted: { destroy(): void } | undefined;

  const showError = (message: string): void => {
    els.error.textContent = message;
    els.error.hidden = message === '';
  };

  const mountCurrent = (): void => {
    mounted?.destroy();
    mounted = undefined;
    els.output.replaceChildren();
    if (graph !== undefined) mounted = mount(els.output, graph);
  };

  return {
    get graph() {
      return graph;
    },
    get files() {
      return files;
    },
    load(next) {
      let built: TokenGraph;
      try {
        built = buildTokenGraphFromFiles(next);
      } catch (error) {
        showError(error instanceof Error ? error.message : String(error));
        return false;
      }
      showError('');
      graph = built;
      files = [...next];
      mountCurrent();
      return true;
    },
    remount: mountCurrent,
    exportSvg() {
      return graph === undefined ? undefined : renderTokenGraphToSvg(graph);
    },
    destroy() {
      mounted?.destroy();
      mounted = undefined;
      els.output.replaceChildren();
      graph = undefined;
      files = [];
    },
  };
}
