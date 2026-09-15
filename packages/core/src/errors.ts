const DTCG_SPEC_URL = 'https://www.designtokens.org/tr/2025.10/format/';

/** Thrown when a document does not conform to the DTCG format. */
export class DtcgParseError extends Error {
  /** Group/token path from the document root to the offending node. */
  readonly path: string[];
  /** Section of the DTCG spec this rule comes from. */
  readonly specReference: string;

  constructor(message: string, path: string[], specReference: string = DTCG_SPEC_URL) {
    const location = path.length > 0 ? ` at "${path.join('.')}"` : ' at the document root';
    super(`${message}${location} (see ${specReference})`);
    this.name = 'DtcgParseError';
    this.path = path;
    this.specReference = specReference;
  }
}

/** A modifier a caller may still pick a context for, as reported by {@link MissingResolverContextsError}. */
export interface ResolverModifierChoice {
  name: string;
  /** The modifier's context names, in declaration order. */
  contexts: string[];
  /** The context applied when no input picks one, when the modifier declares one. */
  default?: string;
}

function describeChoices(modifiers: ResolverModifierChoice[], name: string): string {
  return modifiers.find((modifier) => modifier.name === name)?.contexts.join(', ') ?? '';
}

function describeMissingContexts(modifiers: ResolverModifierChoice[], missing: string[]): string {
  if (missing.length === 1) {
    return (
      `Modifier "${missing[0]}" has no default context and none was given` +
      ` — choose one of: ${describeChoices(modifiers, missing[0])}`
    );
  }
  const quoted = missing.map((name) => `"${name}"`).join(', ');
  const choices = missing.map((name) => `${name} (${describeChoices(modifiers, name)})`).join(', ');
  return (
    `Modifiers ${quoted} have no default context and none was given` +
    ` — choose a context for each: ${choices}`
  );
}

/**
 * Thrown when a resolver cannot be resolved because one or more modifiers declare no `default`
 * and the input named no context for them — which the spec makes an error rather than something
 * to guess at. The modifiers ride along on the error so a caller that is able to ask (a UI with a
 * context picker, a CLI that can print the choices) has everything it needs to retry.
 */
export class MissingResolverContextsError extends DtcgParseError {
  /** Every modifier the resolver declares, declared ones first, then those inlined in `resolutionOrder`. */
  readonly modifiers: ResolverModifierChoice[];
  /** Names of the modifiers still waiting for a context — a non-empty subset of {@link modifiers}. */
  readonly missing: string[];
  /** The resolver document's source identifier, when the caller named one. */
  readonly resolverSource?: string;

  constructor(
    modifiers: ResolverModifierChoice[],
    missing: string[],
    specReference: string,
    resolverSource?: string,
  ) {
    super(
      describeMissingContexts(modifiers, missing),
      missing.length === 1 ? ['modifiers', missing[0]] : ['modifiers'],
      specReference,
    );
    this.name = 'MissingResolverContextsError';
    this.modifiers = modifiers;
    this.missing = missing;
    this.resolverSource = resolverSource;
  }
}
