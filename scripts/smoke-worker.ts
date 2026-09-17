/**
 * Exerce le Worker **sur son vrai runtime**, avant de le déclarer bon.
 *
 * Les tests unitaires tournent sur Node : ils ne voient ni le bundle, ni les
 * bindings, ni les drapeaux de compatibilité, ni le fait qu'un Worker n'a pas
 * de système de fichiers. Une importation de `node:fs` enfouie dans une
 * dépendance passe le build sans un mot et n'échoue qu'en production.
 *
 * Ce script monte `wrangler dev` — workerd, localement, sans aucun compte — et
 * tape les routes qui comptent. C'est la seule vérification qui prouve que ce
 * qui est déployé fonctionne.
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
    name: 'le contenu est servi, et porte sa version',
    run: async () => {
      const response = await fetch(`${BASE}/v1/portfolio`);
      expect(response.status === 200, `attendu 200, reçu ${String(response.status)}`);
      const body = (await response.json()) as { meta: { contentVersion: string } };
      expect(body.meta.contentVersion.length > 0, 'version de contenu absente');
    },
  },
  {
    name: 'la langue se négocie',
    run: async () => {
      const response = await fetch(`${BASE}/v1/profile?lang=en`);
      const body = (await response.json()) as { data: { headline: string } };
      expect(body.data.headline === 'Senior iOS Engineer', `accroche inattendue`);
      expect(response.headers.get('content-language') === 'en', 'Content-Language absent ou faux');
    },
  },
  {
    name: 'le contenu se revalide en 304',
    run: async () => {
      const first = await fetch(`${BASE}/v1/apps`);
      const etag = first.headers.get('etag') ?? '';
      expect(etag.length > 0, 'ETag absent');
      const second = await fetch(`${BASE}/v1/apps`, { headers: { 'If-None-Match': etag } });
      expect(second.status === 304, `attendu 304, reçu ${String(second.status)}`);
    },
  },
  {
    name: 'le CV est relayé depuis le magasin d’assets',
    run: async () => {
      const response = await fetch(`${BASE}${cvPath('fr')}`);
      expect(response.status === 200, `attendu 200, reçu ${String(response.status)}`);
      expect(
        response.headers.get('content-type') === 'application/pdf',
        'type de contenu inattendu',
      );
      const bytes = await response.arrayBuffer();
      expect(bytes.byteLength > 50_000, `PDF trop petit : ${String(bytes.byteLength)} octets`);
    },
  },
  {
    name: 'le CV se revalide sans retélécharger',
    run: async () => {
      const first = await fetch(`${BASE}${cvPath('en')}`);
      const etag = first.headers.get('etag') ?? '';
      const second = await fetch(`${BASE}${cvPath('en')}`, { headers: { 'If-None-Match': etag } });
      expect(second.status === 304, `attendu 304, reçu ${String(second.status)}`);
    },
  },
  {
    name: "le chemin brut de l'asset n'est pas une seconde URL du CV",
    run: async () => {
      const response = await fetch(`${BASE}/cv/manifest.json`);
      expect(response.status === 404, `attendu 404, reçu ${String(response.status)}`);
    },
  },
  {
    name: "l'ancien chemin du CV redirige au lieu de tomber",
    run: async () => {
      const response = await fetch(`${BASE}/v1/cv/fr.pdf`, { redirect: 'manual' });
      expect(response.status === 301, `attendu 301, reçu ${String(response.status)}`);
    },
  },
  {
    name: 'une langue inconnue est refusée',
    run: async () => {
      const response = await fetch(`${BASE}/v1/profile?lang=de`);
      expect(response.status === 400, `attendu 400, reçu ${String(response.status)}`);
    },
  },
  {
    name: 'le contrat est servi par le Worker lui-même',
    run: async () => {
      const response = await fetch(`${BASE}/v1/openapi.json`);
      expect(response.status === 200, `attendu 200, reçu ${String(response.status)}`);
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
          throw new Error(`Worker démarré mais dégradé : ${health.cv.reason ?? 'sans raison'}`);
        }
        return;
      }
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`Worker injoignable après démarrage : ${String(error)}`, {
          cause: error,
        });
      }
    }
    if (Date.now() > deadline) throw new Error('Worker non démarré dans le délai imparti.');
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
  console.error(`[smoke] ✗ démarrage\n         ${String(error)}\n${output}`);
} finally {
  worker.kill('SIGTERM');
}

if (failures > 0) {
  console.error(`[smoke] ${String(failures)} vérification(s) en échec sur workerd.`);
  process.exit(1);
}
console.log(`[smoke] ${String(checks.length)} vérifications passées sur workerd.`);
process.exit(0);
