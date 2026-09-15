const DTCG_SPEC_URL = 'https://tr.designtokens.org/format/';

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
