import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Disk paths — **for the build and the tests only**.
 *
 * Nothing that runs on Cloudflare Workers goes through here: a Worker has no
 * file system. Everything under `src/node/` is out of the runtime by
 * construction, and the repo's ESLint config forbids importing `node:fs`,
 * `node:path` or `node:url` anywhere else in `src/`.
 */

/**
 * The package root, found by walking up to the `package.json`.
 *
 * A hardcoded relative path would start lying the moment a module changes
 * depth; walking up to the marker gives the same answer from anywhere.
 */
function findPackageRoot(from: string): string {
  let current = from;
  for (;;) {
    if (existsSync(join(current, 'package.json'))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`No package root found above ${from}`);
    }
    current = parent;
  }
}

export const PACKAGE_ROOT = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  /** The content files, the portfolio's single source. */
  content: join(PACKAGE_ROOT, 'content'),
  /** The design tokens, a snapshot of the hub repo (see `check:tokens`). */
  designTokens: join(PACKAGE_ROOT, 'design', 'tokens.json'),
  /** The fonts embedded in the PDF. */
  fonts: join(PACKAGE_ROOT, 'assets', 'fonts'),
  /**
   * The **Workers Static Assets** directory, published alongside the Worker.
   * This is where the build drops the rendered résumés and their manifest.
   */
  assets: join(PACKAGE_ROOT, 'public'),
  /** The OpenAPI contract frozen in the repo, so it can be read in review. */
  contract: join(PACKAGE_ROOT, 'contracts', 'openapi.json'),
} as const;

/** The hub repo, source of truth for the design tokens. */
export const DESIGN_TOKENS_SOURCE = {
  rawUrl: 'https://raw.githubusercontent.com/Boris-David/portfolio/main/design/tokens.json',
  /** The same file in the local workspace, when the repos sit side by side. */
  siblingPath: resolve(PACKAGE_ROOT, '..', 'design', 'tokens.json'),
} as const;
