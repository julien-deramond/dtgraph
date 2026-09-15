/** A node in a parsed DTCG token tree that represents a single token. */
export interface TokenNode {
  kind: 'token';
  /** The key this token was declared under (empty string only for a root-level token). */
  name: string;
  /** Group names from the document root down to (and including) this token. */
  path: string[];
  /** The raw, unresolved `$value` (may contain `{alias.references}`). */
  value: unknown;
  /** Own `$type`, or the nearest ancestor group's `$type` if not declared here. */
  type?: string;
  description?: string;
  extensions?: Record<string, unknown>;
}

/** A node in a parsed DTCG token tree that groups other tokens/groups. */
export interface GroupNode {
  kind: 'group';
  /** The key this group was declared under (empty string for the document root). */
  name: string;
  /** Group names from the document root down to (and including) this group. */
  path: string[];
  /** Own `$type`, as declared on this group (not inherited). */
  type?: string;
  description?: string;
  extensions?: Record<string, unknown>;
  children: Record<string, TokenTreeNode>;
}

export type TokenTreeNode = TokenNode | GroupNode;
