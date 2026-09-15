import {
  MissingResolverContextsError,
  buildTokenGraphFromDocuments,
  listResolverModifiers,
  renderTokenGraphToSvg,
} from '@dtgraph/core';
import type { ResolverInput, TokenGraph, TokenGraphBuild } from '@dtgraph/core';

import { checkGraphComplexity, checkUploadComplexity } from './upload-guard.js';

export interface PlaygroundFileInput {
  /** File name, used as the `source` tag for cross-file collision/error messages and resolver `$ref` lookups. */
  source: string;
  content: string;
}

export interface PlaygroundBuildOptions {
  /** Context per modifier, applied when one of the files is a DTCG resolver document. */
  context?: ResolverInput;
}

/**
 * Parse and resolve (across all given files) DTCG token file contents into a `TokenGraph` —
 * entirely in-memory, no network I/O. When one of the files is a DTCG resolver document, the
 * others become the pool its `$ref`s resolve against (matched by file name) and `context` picks
 * each modifier's context. Errors from JSON parsing, DTCG parsing, resolver validation, alias
 * resolution, or cycle detection propagate unmodified, so callers can surface core's own message
 * rather than a generic one. Size/complexity caps (see `upload-guard.ts`) are enforced first,
 * since this input is fully attacker-controlled.
 */
export function buildTokenGraphFromFiles(
  files: PlaygroundFileInput[],
  options: PlaygroundBuildOptions = {},
): TokenGraphBuild {
  checkUploadComplexity(files);

  const documents = files.map(({ source, content }) => ({
    source,
    document: JSON.parse(content) as unknown,
  }));
  const build = buildTokenGraphFromDocuments(documents, { input: options.context });
  checkGraphComplexity(build.graph.nodes.length, build.graph.edges.length);

  return build;
}

/** Parse, resolve, and render token file contents to the static SVG (the "Export SVG" action). */
export function renderTokenFilesToSvg(
  files: PlaygroundFileInput[],
  options: PlaygroundBuildOptions = {},
): string {
  return renderTokenGraphToSvg(buildTokenGraphFromFiles(files, options).graph);
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

export interface PlaygroundModifier {
  name: string;
  contexts: string[];
  /**
   * The context currently applied (from the user's choice or the modifier's default), or
   * `undefined` while this modifier still needs a choice before anything can resolve.
   */
  selected: string | undefined;
}

/**
 * What the page needs to know about the resolver behind the current graph — or, when a modifier
 * is still waiting for a context, about the resolver that could not be resolved yet.
 */
export interface PlaygroundResolver {
  /** File name of the resolver document, when it is known. */
  source: string | undefined;
  modifiers: PlaygroundModifier[];
  /** Files (by name) that the resolver referenced for the current contexts; empty until it resolves. */
  sources: string[];
  /** Loaded files that neither are the resolver nor were referenced by it — silently unused. */
  ignored: string[];
  /**
   * Modifiers that declare no default and have not been answered yet, so nothing has resolved.
   * Empty for a resolver that produced the current graph.
   */
  pending: string[];
}

export interface PlaygroundController {
  /** The last successfully loaded graph, if any. */
  readonly graph: TokenGraph | undefined;
  /** The files behind `graph`. */
  readonly files: readonly PlaygroundFileInput[];
  /** The resolver behind `graph`, when the loaded files contained one. */
  readonly resolver: PlaygroundResolver | undefined;
  /**
   * Parse, resolve, and show `files`, with every resolver modifier at its default context. On
   * failure the error is shown as plain text and whatever was on screen before stays there —
   * except when a resolver modifier has no default, which is reported through
   * {@link PlaygroundResolver.pending} rather than as an error, so the page can ask for a context
   * and retry via {@link setContext}. Returns whether the load succeeded.
   */
  load(files: PlaygroundFileInput[]): boolean;
  /** Rebuild the current files with one modifier switched to another context. */
  setContext(modifier: string, context: string): boolean;
  /** Mount the current graph again (after a display option changed). */
  remount(): void;
  /** The static SVG for the current graph, or `undefined` when nothing is loaded. */
  exportSvg(): string | undefined;
  destroy(): void;
}

function describeResolver(
  files: readonly PlaygroundFileInput[],
  resolver: NonNullable<TokenGraphBuild['resolver']>,
): PlaygroundResolver {
  // Sources may carry a `#/json/pointer` suffix; compare on the file part only.
  const used = new Set(resolver.sources.map((source) => source.replace(/#.*$/, '')));
  return {
    source: resolver.source,
    // Modifiers can be declared under `modifiers` or inline in `resolutionOrder`; both get a selector.
    modifiers: listResolverModifiers(resolver.document).map((modifier) => ({
      name: modifier.name,
      contexts: modifier.contexts,
      selected: resolver.contexts[modifier.name],
    })),
    sources: [...used],
    ignored: files
      .map((file) => file.source)
      .filter((source) => source !== resolver.source && !used.has(source)),
    pending: [],
  };
}

/**
 * The same description for a resolver that has not resolved yet because a modifier declares no
 * default: every modifier gets a selector, with the ones still waiting left unselected. Which
 * files the resolver would pull in is unknowable until it resolves, so no chip is marked used or
 * ignored.
 */
function describePendingResolver(
  error: MissingResolverContextsError,
  context: ResolverInput,
): PlaygroundResolver {
  return {
    source: error.resolverSource,
    modifiers: error.modifiers.map((modifier) => ({
      name: modifier.name,
      contexts: modifier.contexts,
      selected: context[modifier.name] ?? modifier.default,
    })),
    sources: [],
    ignored: [],
    pending: error.missing,
  };
}

/**
 * Wire the playground's state machine to the page: `load` swaps the mounted graph on success
 * and reports failures via `textContent` (error messages quote token paths and file names, all
 * untrusted), never through markup.
 */
export function createPlayground(els: PlaygroundElements, mount: MountGraph): PlaygroundController {
  let graph: TokenGraph | undefined;
  let files: PlaygroundFileInput[] = [];
  let context: ResolverInput = {};
  let resolver: PlaygroundResolver | undefined;
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

  const build = (next: PlaygroundFileInput[], nextContext: ResolverInput): boolean => {
    let built: TokenGraphBuild;
    try {
      built = buildTokenGraphFromFiles(next, { context: nextContext });
    } catch (error) {
      // A resolver that only lacks a context is not a dead end, and not really a failure: the
      // document is valid and simply has an open question. Keep the files it came with so the
      // page can ask that question and `setContext` can retry, and leave the error banner clear
      // — `pending` tells the page to prompt instead. Nothing resolved, so there is no graph.
      if (error instanceof MissingResolverContextsError) {
        showError('');
        graph = undefined;
        files = [...next];
        context = nextContext;
        resolver = describePendingResolver(error, nextContext);
        mountCurrent();
        return false;
      }
      showError(error instanceof Error ? error.message : String(error));
      return false;
    }
    showError('');
    graph = built.graph;
    files = [...next];
    context = nextContext;
    resolver = built.resolver === undefined ? undefined : describeResolver(files, built.resolver);
    mountCurrent();
    return true;
  };

  return {
    get graph() {
      return graph;
    },
    get files() {
      return files;
    },
    get resolver() {
      return resolver;
    },
    load(next) {
      return build(next, {});
    },
    setContext(modifier, selected) {
      return build(files, { ...context, [modifier]: selected });
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
      context = {};
      resolver = undefined;
    },
  };
}
