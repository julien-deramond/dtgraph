import { DtcgParseError } from './errors.js';
import { buildTokenGraph } from './graph.js';
import { flattenTokenTree, parseTokenTree } from './parse.js';
import { mergeTokenTreesWithOverrides, resolveAliasEdgesAcrossFiles } from './resolve.js';
import type { NamedTokenTree } from './resolve.js';
import type { TokenGraph } from './types.js';

const SPEC_BASE = 'https://www.designtokens.org/tr/2025.10/resolver/';

const SPEC = {
  root: `${SPEC_BASE}#root-level-properties`,
  version: `${SPEC_BASE}#version`,
  sets: `${SPEC_BASE}#sets`,
  modifiers: `${SPEC_BASE}#modifiers`,
  contexts: `${SPEC_BASE}#contexts`,
  default: `${SPEC_BASE}#default`,
  resolutionOrder: `${SPEC_BASE}#resolution-order`,
  references: `${SPEC_BASE}#reference-objects`,
  inputs: `${SPEC_BASE}#inputs`,
  invalidPointers: `${SPEC_BASE}#invalid-pointers`,
} as const;

/** The only DTCG Resolver Module version this package understands. */
export const SUPPORTED_RESOLVER_VERSION = '2025.10';

/**
 * One entry of a set's `sources` array or a modifier context's array: either a reference
 * object (`{ "$ref": "file.json" }`, `{ "$ref": "#/sets/other" }`) or an inline DTCG token
 * document.
 */
export type ResolverSource =
  | {
      kind: 'ref';
      /** The raw `$ref` string: a same-document pointer (`#/sets/x`) or a file path, optionally with a `#/json/pointer` suffix. */
      ref: string;
      /** Keys declared next to `$ref`, which the spec says override the referenced tokens. */
      overrides?: Record<string, unknown>;
      /** JSON-pointer-style location of this source inside the resolver, e.g. `["sets", "base", "sources", "0"]`. */
      location: string[];
    }
  | {
      kind: 'inline';
      document: Record<string, unknown>;
      location: string[];
    };

export interface ResolverSet {
  name: string;
  sources: ResolverSource[];
  description?: string;
  extensions?: Record<string, unknown>;
}

export interface ResolverModifier {
  name: string;
  /** Context name → the sources that apply when this context is selected. */
  contexts: Record<string, ResolverSource[]>;
  /** The context used when no input picks one. */
  default?: string;
  description?: string;
  extensions?: Record<string, unknown>;
}

/** One step of `resolutionOrder`, with same-document `$ref`s already resolved to their definition. */
export type ResolverOrderEntry =
  { kind: 'set'; set: ResolverSet } | { kind: 'modifier'; modifier: ResolverModifier };

/** A parsed, validated DTCG resolver document (spec 2025.10, Resolver Module). */
export interface ResolverDocument {
  name?: string;
  version: string;
  description?: string;
  sets: Record<string, ResolverSet>;
  modifiers: Record<string, ResolverModifier>;
  resolutionOrder: ResolverOrderEntry[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/**
 * Whether a raw JSON document looks like a resolver rather than a token file: an object with
 * a `resolutionOrder` array. Shape-based on purpose, so the `.resolver.json` naming convention
 * is a convenience rather than a requirement (browser uploads only carry file names).
 */
export function isResolverDocument(document: unknown): boolean {
  return isPlainObject(document) && Array.isArray(document.resolutionOrder);
}

// ---- Parsing ---------------------------------------------------------------------------------

function readOptionalString(
  value: unknown,
  key: string,
  path: string[],
  spec: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new DtcgParseError(`"${key}" must be a string, got ${describeType(value)}`, path, spec);
  }
  return value;
}

function readOptionalExtensions(value: unknown, path: string[], spec: string) {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    throw new DtcgParseError(
      `"$extensions" must be an object, got ${describeType(value)}`,
      path,
      spec,
    );
  }
  return value;
}

function parseSources(value: unknown, location: string[], spec: string): ResolverSource[] {
  if (!Array.isArray(value)) {
    throw new DtcgParseError(
      `Expected an array of sources, got ${describeType(value)}`,
      location,
      spec,
    );
  }
  return value.map((entry, index): ResolverSource => {
    const entryLocation = [...location, String(index)];
    if (!isPlainObject(entry)) {
      throw new DtcgParseError(
        `A source must be a reference object ({ "$ref": ... }) or an inline token object, got ${describeType(entry)}`,
        entryLocation,
        SPEC.references,
      );
    }
    if (Object.prototype.hasOwnProperty.call(entry, '$ref')) {
      const { $ref, ...rest } = entry;
      if (typeof $ref !== 'string' || $ref.length === 0) {
        throw new DtcgParseError(
          '"$ref" must be a non-empty string',
          entryLocation,
          SPEC.references,
        );
      }
      return {
        kind: 'ref',
        ref: $ref,
        overrides: Object.keys(rest).length > 0 ? rest : undefined,
        location: entryLocation,
      };
    }
    return { kind: 'inline', document: entry, location: entryLocation };
  });
}

function parseSet(name: string, value: unknown, location: string[]): ResolverSet {
  if (!isPlainObject(value)) {
    throw new DtcgParseError(
      `A set must be an object, got ${describeType(value)}`,
      location,
      SPEC.sets,
    );
  }
  return {
    name,
    sources: parseSources(value.sources, [...location, 'sources'], SPEC.sets),
    description: readOptionalString(value.description, 'description', location, SPEC.sets),
    extensions: readOptionalExtensions(value.$extensions, location, SPEC.sets),
  };
}

function parseModifier(name: string, value: unknown, location: string[]): ResolverModifier {
  if (!isPlainObject(value)) {
    throw new DtcgParseError(
      `A modifier must be an object, got ${describeType(value)}`,
      location,
      SPEC.modifiers,
    );
  }
  if (!isPlainObject(value.contexts)) {
    throw new DtcgParseError(
      'A modifier must declare a "contexts" object mapping context names to sources',
      location,
      SPEC.contexts,
    );
  }
  const contexts: Record<string, ResolverSource[]> = {};
  for (const [contextName, sources] of Object.entries(value.contexts)) {
    if (contextName.length === 0) {
      throw new DtcgParseError(
        'Context names must not be empty',
        [...location, 'contexts'],
        SPEC.contexts,
      );
    }
    contexts[contextName] = parseSources(
      sources,
      [...location, 'contexts', contextName],
      SPEC.contexts,
    );
  }
  if (Object.keys(contexts).length === 0) {
    throw new DtcgParseError(
      'A modifier must declare at least one context',
      [...location, 'contexts'],
      SPEC.contexts,
    );
  }
  const defaultContext = readOptionalString(value.default, 'default', location, SPEC.default);
  if (defaultContext !== undefined && !(defaultContext in contexts)) {
    throw new DtcgParseError(
      `Default context "${defaultContext}" is not one of this modifier's contexts (${Object.keys(contexts).join(', ')})`,
      [...location, 'default'],
      SPEC.default,
    );
  }
  return {
    name,
    contexts,
    default: defaultContext,
    description: readOptionalString(value.description, 'description', location, SPEC.modifiers),
    extensions: readOptionalExtensions(value.$extensions, location, SPEC.modifiers),
  };
}

function parseNamedMap<T>(
  value: unknown,
  key: 'sets' | 'modifiers',
  parseEntry: (name: string, entry: unknown, location: string[]) => T,
): Record<string, T> {
  if (value === undefined) return {};
  if (!isPlainObject(value)) {
    throw new DtcgParseError(
      `"${key}" must be an object keyed by name, got ${describeType(value)}`,
      [key],
      SPEC[key],
    );
  }
  const parsed: Record<string, T> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (name.length === 0) {
      throw new DtcgParseError(`Names in "${key}" must not be empty`, [key], SPEC[key]);
    }
    parsed[name] = parseEntry(name, entry, [key, name]);
  }
  return parsed;
}

/** Split a same-document pointer like `#/sets/base` into `["sets", "base"]`, or undefined if it isn't one. */
function parseLocalPointer(ref: string): string[] | undefined {
  if (!ref.startsWith('#')) return undefined;
  return splitJsonPointer(ref.slice(1));
}

function splitJsonPointer(pointer: string): string[] {
  const trimmed = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  if (trimmed.length === 0) return [];
  return trimmed.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function parseOrderEntry(
  entry: unknown,
  index: number,
  sets: Record<string, ResolverSet>,
  modifiers: Record<string, ResolverModifier>,
): ResolverOrderEntry {
  const location = ['resolutionOrder', String(index)];
  if (!isPlainObject(entry)) {
    throw new DtcgParseError(
      `A resolution order entry must be a reference object or an inline set/modifier, got ${describeType(entry)}`,
      location,
      SPEC.resolutionOrder,
    );
  }

  if (Object.prototype.hasOwnProperty.call(entry, '$ref')) {
    const ref = entry.$ref;
    if (typeof ref !== 'string') {
      throw new DtcgParseError('"$ref" must be a string', location, SPEC.references);
    }
    const pointer = parseLocalPointer(ref);
    if (pointer !== undefined && pointer.length === 2 && pointer[0] === 'sets') {
      const set = sets[pointer[1]];
      if (set === undefined) {
        throw new DtcgParseError(
          `"${ref}" does not point to a declared set`,
          location,
          SPEC.invalidPointers,
        );
      }
      return { kind: 'set', set };
    }
    if (pointer !== undefined && pointer.length === 2 && pointer[0] === 'modifiers') {
      const modifier = modifiers[pointer[1]];
      if (modifier === undefined) {
        throw new DtcgParseError(
          `"${ref}" does not point to a declared modifier`,
          location,
          SPEC.invalidPointers,
        );
      }
      return { kind: 'modifier', modifier };
    }
    throw new DtcgParseError(
      `A resolution order "$ref" must point to "#/sets/<name>" or "#/modifiers/<name>", got "${ref}"`,
      location,
      SPEC.invalidPointers,
    );
  }

  const { type, name, ...definition } = entry;
  if (typeof name !== 'string' || name.length === 0) {
    throw new DtcgParseError(
      'An inline resolution order entry must have a non-empty "name"',
      location,
      SPEC.resolutionOrder,
    );
  }
  if (type === 'set') return { kind: 'set', set: parseSet(name, definition, location) };
  if (type === 'modifier') {
    return { kind: 'modifier', modifier: parseModifier(name, definition, location) };
  }
  throw new DtcgParseError(
    `An inline resolution order entry must have "type": "set" or "type": "modifier", got ${JSON.stringify(type)}`,
    location,
    SPEC.resolutionOrder,
  );
}

/**
 * Parse a raw JSON document into a validated {@link ResolverDocument}. Same-document `$ref`s in
 * `resolutionOrder` are checked and resolved here; file references inside sets and contexts are
 * only resolved when a graph is built (see {@link buildTokenGraphFromResolver}).
 */
export function parseResolverDocument(document: unknown): ResolverDocument {
  if (!isPlainObject(document)) {
    throw new DtcgParseError(
      `A DTCG resolver document must be a JSON object, got ${describeType(document)}`,
      [],
      SPEC.root,
    );
  }

  const version = document.version;
  if (typeof version !== 'string') {
    throw new DtcgParseError(
      'A resolver document must declare a "version" string',
      [],
      SPEC.version,
    );
  }
  if (version !== SUPPORTED_RESOLVER_VERSION) {
    throw new DtcgParseError(
      `Unsupported resolver version "${version}" — this tool implements "${SUPPORTED_RESOLVER_VERSION}"`,
      ['version'],
      SPEC.version,
    );
  }

  const sets = parseNamedMap(document.sets, 'sets', parseSet);
  const modifiers = parseNamedMap(document.modifiers, 'modifiers', parseModifier);

  if (!Array.isArray(document.resolutionOrder)) {
    throw new DtcgParseError(
      'A resolver document must declare a "resolutionOrder" array',
      [],
      SPEC.resolutionOrder,
    );
  }
  const resolutionOrder = document.resolutionOrder.map((entry, index) =>
    parseOrderEntry(entry, index, sets, modifiers),
  );

  return {
    name: readOptionalString(document.name, 'name', [], SPEC.root),
    version,
    description: readOptionalString(document.description, 'description', [], SPEC.root),
    sets,
    modifiers,
    resolutionOrder,
  };
}

// ---- Resolution ------------------------------------------------------------------------------

/** One raw token document made available to `$ref` lookups, identified by its path or file name. */
export interface ResolverFileInput {
  source: string;
  /** The parsed JSON (not yet parsed as DTCG). */
  document: unknown;
}

/** Modifier name → the context to select, e.g. `{ theme: "dark" }`. */
export type ResolverInput = Record<string, string>;

export interface BuildTokenGraphFromResolverOptions {
  resolver: ResolverDocument;
  /** Path or file name of the resolver, used to resolve relative `$ref`s and to tag inline sources. */
  resolverSource?: string;
  /** The token files referenced by the resolver. */
  files: ResolverFileInput[];
  /** Context selection per modifier; modifiers not listed fall back to their `default`. */
  input?: ResolverInput;
}

export interface ResolverResolution {
  graph: TokenGraph;
  /** The context that was applied for every modifier, inputs and defaults combined. */
  contexts: Record<string, string>;
  /** Source identifiers that contributed tokens, in resolution order, without duplicates. */
  sources: string[];
}

function collectModifiers(resolver: ResolverDocument): Record<string, ResolverModifier> {
  const all: Record<string, ResolverModifier> = { ...resolver.modifiers };
  for (const entry of resolver.resolutionOrder) {
    if (entry.kind !== 'modifier' || entry.modifier === resolver.modifiers[entry.modifier.name]) {
      continue;
    }
    if (all[entry.modifier.name] !== undefined) {
      throw new DtcgParseError(
        `Inline modifier "${entry.modifier.name}" has the same name as a declared modifier`,
        ['resolutionOrder'],
        SPEC.resolutionOrder,
      );
    }
    all[entry.modifier.name] = entry.modifier;
  }
  return all;
}

/**
 * Pick one context per modifier from `input` (falling back to each modifier's `default`),
 * rejecting inputs that name an unknown modifier or context and modifiers left without a
 * context.
 */
function selectContexts(resolver: ResolverDocument, input: ResolverInput): Record<string, string> {
  const modifiers = collectModifiers(resolver);

  for (const [name, context] of Object.entries(input)) {
    const modifier = modifiers[name];
    if (modifier === undefined) {
      const known = Object.keys(modifiers);
      throw new DtcgParseError(
        `Unknown modifier "${name}" in input` +
          (known.length > 0
            ? ` — declared modifiers: ${known.join(', ')}`
            : ' — this resolver declares no modifiers'),
        ['modifiers', name],
        SPEC.inputs,
      );
    }
    if (!(context in modifier.contexts)) {
      throw new DtcgParseError(
        `Unknown context "${context}" for modifier "${name}" — available contexts: ${Object.keys(modifier.contexts).join(', ')}`,
        ['modifiers', name],
        SPEC.inputs,
      );
    }
  }

  const contexts: Record<string, string> = {};
  for (const modifier of Object.values(modifiers)) {
    const selected = input[modifier.name] ?? modifier.default;
    if (selected === undefined) {
      throw new DtcgParseError(
        `Modifier "${modifier.name}" has no default context and none was given — choose one of: ${Object.keys(modifier.contexts).join(', ')}`,
        ['modifiers', modifier.name],
        SPEC.inputs,
      );
    }
    contexts[modifier.name] = selected;
  }
  return contexts;
}

function normalizePath(path: string): string {
  const absolute = path.startsWith('/');
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!absolute) {
        segments.push('..');
      }
      continue;
    }
    segments.push(segment);
  }
  return (absolute ? '/' : '') + segments.join('/');
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function baseNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Find the file a `$ref` path points at among the provided files: by exact source match first,
 * then by the path relative to the resolver's own directory, then by unique file name (the
 * browser only knows file names, not paths).
 */
function findReferencedFile(
  refPath: string,
  files: ResolverFileInput[],
  resolverSource: string | undefined,
  location: string[],
): ResolverFileInput {
  const exact = files.find((file) => file.source === refPath);
  if (exact !== undefined) return exact;

  const base = resolverSource === undefined ? '' : directoryOf(resolverSource);
  const relative = normalizePath(base === '' ? refPath : `${base}/${refPath}`);
  const byRelativePath = files.find((file) => normalizePath(file.source) === relative);
  if (byRelativePath !== undefined) return byRelativePath;

  const name = baseNameOf(refPath);
  const byName = files.filter((file) => baseNameOf(file.source) === name);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new DtcgParseError(
      `"$ref": "${refPath}" is ambiguous — it matches several files by name: ${byName.map((file) => `"${file.source}"`).join(', ')}`,
      location,
      SPEC.references,
    );
  }

  const available = files.map((file) => `"${file.source}"`).join(', ');
  throw new DtcgParseError(
    `"$ref": "${refPath}" does not match any provided file` +
      (files.length > 0 ? ` (provided: ${available})` : ' (no token files were provided)'),
    location,
    SPEC.references,
  );
}

function applyJsonPointer(
  document: unknown,
  pointer: string,
  refPath: string,
  location: string[],
): unknown {
  let current = document;
  for (const segment of splitJsonPointer(pointer)) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      throw new DtcgParseError(
        `"$ref": "${refPath}#${pointer}" points at nothing — "${segment}" was not found in the referenced document`,
        location,
        SPEC.invalidPointers,
      );
    }
    current = current[segment];
  }
  return current;
}

interface FlattenState {
  resolver: ResolverDocument;
  resolverSource: string | undefined;
  files: ResolverFileInput[];
  trees: NamedTokenTree[];
  /** Set names currently being expanded, to detect `#/sets/...` cycles. */
  setStack: string[];
}

function inlineSourceId(state: FlattenState, location: string[]): string {
  return `${state.resolverSource ?? 'resolver'}#/${location.join('/')}`;
}

function flattenSet(state: FlattenState, set: ResolverSet, location: string[]): void {
  const cycleStart = state.setStack.indexOf(set.name);
  if (cycleStart !== -1) {
    const cycle = [...state.setStack.slice(cycleStart), set.name];
    throw new DtcgParseError(
      `Circular set reference: ${cycle.map((name) => `#/sets/${name}`).join(' → ')}`,
      location,
      SPEC.invalidPointers,
    );
  }
  state.setStack.push(set.name);
  flattenSources(state, set.sources);
  state.setStack.pop();
}

function flattenSources(state: FlattenState, sources: ResolverSource[]): void {
  for (const source of sources) {
    if (source.kind === 'inline') {
      state.trees.push({
        source: inlineSourceId(state, source.location),
        tree: parseTokenTree(source.document),
      });
      continue;
    }

    const pointer = parseLocalPointer(source.ref);
    if (pointer !== undefined) {
      if (pointer.length === 2 && pointer[0] === 'sets') {
        const set = state.resolver.sets[pointer[1]];
        if (set === undefined) {
          throw new DtcgParseError(
            `"$ref": "${source.ref}" does not point to a declared set`,
            source.location,
            SPEC.invalidPointers,
          );
        }
        flattenSet(state, set, source.location);
      } else if (pointer.length >= 1 && pointer[0] === 'modifiers') {
        throw new DtcgParseError(
          `"$ref": "${source.ref}" is not allowed here — sets and contexts may reference sets, never modifiers`,
          source.location,
          SPEC.invalidPointers,
        );
      } else {
        throw new DtcgParseError(
          `"$ref": "${source.ref}" must point to "#/sets/<name>" when it references the resolver itself`,
          source.location,
          SPEC.invalidPointers,
        );
      }
    } else {
      const hashIndex = source.ref.indexOf('#');
      const refPath = hashIndex === -1 ? source.ref : source.ref.slice(0, hashIndex);
      const refPointer = hashIndex === -1 ? '' : source.ref.slice(hashIndex + 1);
      const file = findReferencedFile(refPath, state.files, state.resolverSource, source.location);
      const document =
        refPointer === ''
          ? file.document
          : applyJsonPointer(file.document, refPointer, refPath, source.location);
      state.trees.push({
        source: refPointer === '' ? file.source : `${file.source}#${refPointer}`,
        tree: parseTokenTree(document),
      });
    }

    if (source.overrides !== undefined) {
      state.trees.push({
        source: inlineSourceId(state, source.location),
        tree: parseTokenTree(source.overrides),
      });
    }
  }
}

/**
 * Build a token graph for one combination of contexts, following the resolver's
 * `resolutionOrder`: sets are expanded to their sources, each modifier contributes the sources of
 * its selected context, and tokens defined later override tokens at the same path defined
 * earlier. Aliases are resolved only after this merge, so a `{semantic.bg}` alias in a shared
 * components file follows whichever theme was selected.
 */
export function buildTokenGraphFromResolver(
  options: BuildTokenGraphFromResolverOptions,
): ResolverResolution {
  const { resolver, resolverSource, files } = options;
  const contexts = selectContexts(resolver, options.input ?? {});

  const state: FlattenState = { resolver, resolverSource, files, trees: [], setStack: [] };
  resolver.resolutionOrder.forEach((entry, index) => {
    if (entry.kind === 'set') {
      flattenSet(state, entry.set, ['resolutionOrder', String(index)]);
    } else {
      flattenSources(state, entry.modifier.contexts[contexts[entry.modifier.name]]);
    }
  });

  const { nodes, edges } = mergeTokenTreesWithOverrides(state.trees);
  const sources = [...new Set(state.trees.map((tree) => tree.source))];
  return { graph: buildTokenGraph(nodes, edges), contexts, sources };
}

// ---- Auto-detecting entry point --------------------------------------------------------------

/** One raw JSON document handed to {@link buildTokenGraphFromDocuments}: a token file or a resolver. */
export interface TokenDocumentInput {
  source: string;
  document: unknown;
}

export interface BuildTokenGraphFromDocumentsOptions {
  /** Context selection per modifier; only meaningful when one of the documents is a resolver. */
  input?: ResolverInput;
}

export interface TokenGraphBuild {
  graph: TokenGraph;
  /** Present when a resolver document was found among the inputs and drove the build. */
  resolver?: {
    source: string;
    document: ResolverDocument;
    contexts: Record<string, string>;
    /** Source identifiers that contributed tokens, in resolution order. */
    sources: string[];
  };
}

/**
 * Build a token graph from a bag of documents, detecting whether one of them is a resolver:
 *
 * - **No resolver**: every document is a token file; they are merged into one strict token space
 *   (a path defined twice is an error) and aliases resolve across all of them.
 * - **One resolver**: the other documents form the pool its `$ref`s resolve against, contexts are
 *   picked from `input` (or each modifier's `default`), and tokens merge with override semantics.
 *
 * More than one resolver is rejected, as is an `input` given without any resolver.
 */
export function buildTokenGraphFromDocuments(
  files: TokenDocumentInput[],
  options: BuildTokenGraphFromDocumentsOptions = {},
): TokenGraphBuild {
  const resolvers = files.filter((file) => isResolverDocument(file.document));
  if (resolvers.length > 1) {
    throw new DtcgParseError(
      `Expected at most one resolver document, got ${resolvers.length}: ${resolvers.map((file) => `"${file.source}"`).join(', ')}`,
      [],
      SPEC.root,
    );
  }

  const input = options.input ?? {};
  if (resolvers.length === 0) {
    if (Object.keys(input).length > 0) {
      throw new DtcgParseError(
        `Contexts were given (${Object.entries(input)
          .map(([name, context]) => `${name}=${context}`)
          .join(', ')}) but none of the files is a resolver document`,
        [],
        SPEC.inputs,
      );
    }
    const namedTrees: NamedTokenTree[] = files.map(({ source, document }) => ({
      source,
      tree: parseTokenTree(document),
    }));
    const nodes = namedTrees.flatMap(({ tree }) => flattenTokenTree(tree));
    const edges = resolveAliasEdgesAcrossFiles(namedTrees);
    return { graph: buildTokenGraph(nodes, edges) };
  }

  const [resolverFile] = resolvers;
  const resolver = parseResolverDocument(resolverFile.document);
  const resolution = buildTokenGraphFromResolver({
    resolver,
    resolverSource: resolverFile.source,
    files: files.filter((file) => file !== resolverFile),
    input,
  });
  return {
    graph: resolution.graph,
    resolver: {
      source: resolverFile.source,
      document: resolver,
      contexts: resolution.contexts,
      sources: resolution.sources,
    },
  };
}
