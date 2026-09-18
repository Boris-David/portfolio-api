/**
 * Exercises the Worker **on its real runtime**, before calling it good.
 *
 * The unit tests run on Node: they see neither the bundle, nor the bindings,
 * nor the compatibility flags, nor the fact that a Worker has no file system.
 * A `node:fs` import buried in a dependency passes the build without a word
 * and only fails in production.
 *
 * This script brings up `wrangler dev` — workerd, locally, with no account at
 * all — and hits the routes that matter. It is the only check that proves what
 * gets deployed works.
 */
import { spawn } from 'node:child_process';
import { cvPath } from '../src/http/app.js';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8787;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const READY_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;

interface Check {
  readonly name: string;
  readonly run: () => Promise<void>;
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const checks: readonly Check[] = [
  {
    name: 'content is served, and carries its version',
    run: async () => {
      const response = await fetch(`${BASE}/v1/portfolio`);
      expect(response.status === 200, `expected 200, got ${String(response.status)}`);
      const body = (await response.json()) as { meta: { contentVersion: string } };
      expect(body.meta.contentVersion.length > 0, 'content version missing');
    },
  },
  {
    name: 'the language is negotiated',
    run: async () => {
      const response = await fetch(`${BASE}/v1/profile?lang=en`);
      const body = (await response.json()) as { data: { headline: string } };
      expect(body.data.headline === 'Senior iOS Engineer', `unexpected headline`);
      expect(
        response.headers.get('content-language') === 'en',
        'Content-Language missing or wrong',
      );
    },
  },
  {
    name: 'content revalidates to a 304',
    run: async () => {
      const first = await fetch(`${BASE}/v1/apps`);
      const etag = first.headers.get('etag') ?? '';
      expect(etag.length > 0, 'ETag missing');
      const second = await fetch(`${BASE}/v1/apps`, { headers: { 'If-None-Match': etag } });
      expect(second.status === 304, `expected 304, got ${String(second.status)}`);
    },
  },
  {
    name: 'the résumé is relayed from the asset store',
    run: async () => {
      const response = await fetch(`${BASE}${cvPath('fr')}`);
      expect(response.status === 200, `expected 200, got ${String(response.status)}`);
      expect(response.headers.get('content-type') === 'application/pdf', 'unexpected content type');
      const bytes = await response.arrayBuffer();
      expect(bytes.byteLength > 50_000, `PDF too small: ${String(bytes.byteLength)} bytes`);
    },
  },
  {
    name: 'the résumé revalidates without re-downloading',
    run: async () => {
      const first = await fetch(`${BASE}${cvPath('en')}`);
      const etag = first.headers.get('etag') ?? '';
      const second = await fetch(`${BASE}${cvPath('en')}`, { headers: { 'If-None-Match': etag } });
      expect(second.status === 304, `expected 304, got ${String(second.status)}`);
    },
  },
  {
    name: 'the raw asset path is not a second URL for the résumé',
    run: async () => {
      const response = await fetch(`${BASE}/cv/manifest.json`);
      expect(response.status === 404, `expected 404, got ${String(response.status)}`);
    },
  },
  {
    name: 'the old résumé path redirects instead of dying',
    run: async () => {
      const response = await fetch(`${BASE}/v1/cv/fr.pdf`, { redirect: 'manual' });
      expect(response.status === 301, `expected 301, got ${String(response.status)}`);
    },
  },
  {
    name: 'an unknown language is refused',
    run: async () => {
      const response = await fetch(`${BASE}/v1/profile?lang=de`);
      expect(response.status === 400, `expected 400, got ${String(response.status)}`);
    },
  },
  {
    name: 'the contract is served by the Worker itself',
    run: async () => {
      const response = await fetch(`${BASE}/v1/openapi.json`);
      expect(response.status === 200, `expected 200, got ${String(response.status)}`);
    },
  },
];

async function waitUntilReady(deadline: number): Promise<void> {
  for (;;) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) {
        const health = (await response.json()) as { status: string; cv: { reason: string | null } };
        if (health.status !== 'ok') {
          throw new Error(`Worker started but degraded: ${health.cv.reason ?? 'no reason given'}`);
        }
        return;
      }
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`Worker unreachable after startup: ${String(error)}`, {
          cause: error,
        });
      }
    }
    if (Date.now() > deadline) throw new Error('Worker did not start within the allotted time.');
    await sleep(POLL_INTERVAL_MS);
  }
}

const worker = spawn('npx', ['wrangler', 'dev', '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
worker.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
worker.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

let failures = 0;
try {
  await waitUntilReady(Date.now() + READY_TIMEOUT_MS);
  for (const check of checks) {
    try {
      await check.run();
      console.log(`[smoke] ✓ ${check.name}`);
    } catch (error) {
      failures += 1;
      console.error(`[smoke] ✗ ${check.name}\n         ${String(error)}`);
    }
  }
} catch (error) {
  failures += 1;
  console.error(`[smoke] ✗ startup\n         ${String(error)}\n${output}`);
} finally {
  worker.kill('SIGTERM');
}

if (failures > 0) {
  console.error(`[smoke] ${String(failures)} check(s) failed on workerd.`);
  process.exit(1);
}
console.log(`[smoke] ${String(checks.length)} checks passed on workerd.`);
process.exit(0);
