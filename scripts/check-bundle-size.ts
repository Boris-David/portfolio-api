/**
 * Checks that the Worker script fits under the free plan's ceiling.
 *
 * The content is **bundled into the script**: it grows with every app added,
 * with every case study. The ceiling is not a distant abstraction, it is a
 * limit a content addition can cross — and the day it does, the deployment
 * fails without warning.
 *
 * This guard says so beforehand, with the remaining headroom.
 */
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../src/node/paths.js';

const BUNDLE = join(PACKAGE_ROOT, 'dist', 'worker.js');

/** The free plan's ceiling, on the **compressed** script. */
const LIMIT_BYTES = 1024 * 1024;

const KIB = 1024;
const PERCENT = 100;

if (!existsSync(BUNDLE)) {
  console.error(
    `[bundle] ${BUNDLE} is missing. Run "npm run build" — that is what produces the script.`,
  );
  process.exit(1);
}

const compressed = gzipSync(readFileSync(BUNDLE)).byteLength;
const used = (compressed / LIMIT_BYTES) * PERCENT;

const summary =
  `${(compressed / KIB).toFixed(1)} KiB compressed out of ${String(LIMIT_BYTES / KIB)} KiB ` +
  `(${used.toFixed(1)} %)`;

if (compressed > LIMIT_BYTES) {
  console.error(
    `[bundle] script too large: ${summary}.\n` +
      `         The content is bundled into the script; whatever cannot fit in it ` +
      `goes into the Workers Static Assets, like the résumés.`,
  );
  process.exit(1);
}

console.log(`[bundle] ${summary}`);
