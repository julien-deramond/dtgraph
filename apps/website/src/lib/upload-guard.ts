/**
 * Hardening for the playground, which is the one place in dtgraph that runs entirely on
 * attacker-controlled input. `@dtgraph/core`'s tree walkers (parsing, alias/composite-member
 * resolution, flattening) are recursive with no depth limit of their own, so a maliciously
 * deep or huge JSON payload could hang the tab or blow the call stack before core ever gets a
 * chance to report a clean error. These checks run first and reject anything implausible with
 * a specific, friendly message — deliberately hand-rolled (matching the rest of this codebase,
 * which doesn't use a schema-validation library like zod/ajv anywhere else) rather than adding
 * a new dependency for what's fundamentally a handful of size/depth/count comparisons.
 */

export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB combined across all files
export const MAX_JSON_DEPTH = 64;
export const MAX_JSON_NODES = 20_000; // objects/arrays visited while walking the raw parsed JSON
export const MAX_GRAPH_NODES = 5_000;
export const MAX_GRAPH_EDGES = 10_000;

/** Thrown when an upload is rejected for exceeding a size/complexity cap, not a DTCG spec violation. */
export class UploadTooComplexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadTooComplexError';
  }
}

export interface UploadFileInput {
  source: string;
  content: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walk a parsed JSON value, rejecting it if it's implausible as a DTCG document: too deeply
 * nested (stack-overflow risk in core's recursive walkers) or containing an implausible number
 * of objects/arrays (memory/CPU risk). Returns normally if the value is within bounds.
 */
function checkParsedComplexity(
  value: unknown,
  source: string,
  depth: number,
  nodeCount: { count: number },
): void {
  if (depth > MAX_JSON_DEPTH) {
    throw new UploadTooComplexError(
      `"${source}" is nested too deeply to render (over ${MAX_JSON_DEPTH} levels) — this doesn't look like a DTCG token file.`,
    );
  }

  if (Array.isArray(value)) {
    for (const element of value) {
      nodeCount.count += 1;
      if (nodeCount.count > MAX_JSON_NODES) {
        throw new UploadTooComplexError(
          `"${source}" is too large or complex to render (over ${MAX_JSON_NODES} nodes).`,
        );
      }
      checkParsedComplexity(element, source, depth + 1, nodeCount);
    }
    return;
  }

  if (isPlainObject(value)) {
    for (const member of Object.values(value)) {
      nodeCount.count += 1;
      if (nodeCount.count > MAX_JSON_NODES) {
        throw new UploadTooComplexError(
          `"${source}" is too large or complex to render (over ${MAX_JSON_NODES} nodes).`,
        );
      }
      checkParsedComplexity(member, source, depth + 1, nodeCount);
    }
  }
}

/**
 * Reject an upload before it reaches `@dtgraph/core`, if it exceeds size or structural
 * complexity caps. Throws `UploadTooComplexError` with a message specific enough to act on.
 */
export function checkUploadComplexity(files: UploadFileInput[]): void {
  let totalBytes = 0;
  for (const file of files) {
    const bytes = new TextEncoder().encode(file.content).length;
    totalBytes += bytes;
    if (bytes > MAX_FILE_BYTES) {
      throw new UploadTooComplexError(
        `"${file.source}" is too large to render (${bytes} bytes, over the ${MAX_FILE_BYTES}-byte limit).`,
      );
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new UploadTooComplexError(
      `These files are too large to render together (${totalBytes} bytes, over the ${MAX_TOTAL_BYTES}-byte limit).`,
    );
  }

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      // Not our job here — @dtgraph/core will parse (and report) this properly.
      continue;
    }
    checkParsedComplexity(parsed, file.source, 0, { count: 0 });
  }
}

/**
 * Reject a resolved token graph that's implausibly large, as a defense-in-depth check after
 * resolution (composite-member/array aliasing can multiply edge count beyond the raw node
 * count the pre-parse check already bounds).
 */
export function checkGraphComplexity(nodeCount: number, edgeCount: number): void {
  if (nodeCount > MAX_GRAPH_NODES) {
    throw new UploadTooComplexError(
      `This token graph is too large to render (${nodeCount} tokens, over the ${MAX_GRAPH_NODES}-token limit).`,
    );
  }
  if (edgeCount > MAX_GRAPH_EDGES) {
    throw new UploadTooComplexError(
      `This token graph is too large to render (${edgeCount} edges, over the ${MAX_GRAPH_EDGES}-edge limit).`,
    );
  }
}
