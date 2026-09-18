/**
 * The errors of the domain and of content loading.
 *
 * They are **fatal by nature**: invalid content has no acceptable degraded
 * mode — serving a half-wrong portfolio is worse than serving nothing. So they
 * surface at startup, never in the middle of a request.
 */

export class ContentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A content text breaks the inline emphasis grammar. */
export class MarkupError extends ContentError {
  readonly source: string;

  constructor(source: string, reason: string) {
    super(`Invalid markup (${reason}) in: ${JSON.stringify(source)}`);
    this.source = source;
  }
}

/** A content file does not satisfy the schema. */
export class ContentValidationError extends ContentError {
  readonly file: string;

  constructor(file: string, issues: string) {
    super(`Invalid content — ${file}\n${issues}`);
    this.file = file;
  }
}

/**
 * A domain schema uses a Zod node the derivation cannot translate. Throw
 * rather than let it through: a node silently ignored would produce an
 * over-permissive file schema, and therefore a validation that lies.
 */
export class UnsupportedSchemaNodeError extends ContentError {
  constructor(nodeName: string, path: string) {
    super(
      `Zod node not supported by the content schema derivation: ` +
        `${nodeName} (at "${path}"). Add support for it in ` +
        `src/content/derive.ts rather than working around it.`,
    );
  }
}
