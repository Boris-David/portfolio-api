---
paths:
  - 'src/worker.ts'
  - 'wrangler.jsonc'
  - 'scripts/smoke-worker.ts'
  - 'scripts/check-bundle-size.ts'
---

# Le Worker Cloudflare

> L'API tourne sur Cloudflare Workers — plan gratuit, **sans carte bancaire**.
> C'est la contrainte qui a écarté Cloud Run, et elle n'est pas négociable.

## Ce que la plateforme retire

**Pas de système de fichiers.** Le contenu est embarqué à la compilation
(`src/content/documents.ts`). Rien, dans le graphe d'importation de
`src/worker.ts`, ne doit toucher `node:fs`, `node:path` ou `node:url` — l'ESLint
du dépôt refuse ces importations partout sauf dans `src/node/` et les modules de
build du CV.

`node:crypto` est la **seule** exception, et elle est méritée : workerd
l'implémente et rend le même octet que Node, ce qui est la condition pour
comparer une empreinte calculée au build à une empreinte calculée dans l'isolat.

**Un script plafonné.** Le contenu vit dedans, donc il grossit avec le
portfolio. `npm run check:bundle` mesure la marge restante. Ce qui ne peut pas
tenir dans le script va dans les **Workers Static Assets** — c'est le cas des
CV, ~330 Ko chacun.

## Le travail se fait au démarrage de l'isolat

Charger, valider et projeter le contenu se fait **au niveau module**, pas dans
un handler : le budget CPU d'une requête est étroit, celui du démarrage ne l'est
pas. Et un contenu invalide doit faire échouer le déploiement, pas les requêtes
des lecteurs.

Ne pas rendre ce travail paresseux « pour accélérer le démarrage » : ça le
déplacerait dans la première requête, c'est-à-dire là où il coûte le plus cher.

## Le magasin d'assets

Le binding `ASSETS` n'existe que dans `c.env`, donc par requête. C'est pourquoi
la dépendance CV de l'application est un **résolveur** et non une valeur.

`run_worker_first` couvre les chemins bruts des CV : sans lui, chaque PDF aurait
deux URL publiques — la route documentée et son chemin d'asset, servi sans nos
en-têtes. Le binding, lui, atteint le magasin directement.

Décrire un CV ne lit jamais ses octets. Une revalidation n'a besoin que de
l'`ETag` ; télécharger 330 Ko pour répondre « vous l'avez déjà » serait absurde.

## Avant de dire que ça marche

```sh
npm run build:cv && npm run build && npm run check:bundle && npm run smoke
```

`npm run smoke` monte **workerd** localement — aucun compte requis — et tape les
routes réelles. Les tests unitaires tournent sur Node : ils ne voient ni le
bundle, ni les bindings, ni l'absence de disque. Un `node:fs` enfoui passe le
build sans un mot et n'échoue qu'en production ; c'est ce script qui l'attrape.

## Le déploiement

`wrangler.jsonc` est la configuration versionnée : entrée, assets, domaine
personnalisé, date de compatibilité. Rien ne se clique dans le tableau de bord —
ce qui s'y ferait à la main ne serait ni relisible ni reproductible.

Avancer `compatibility_date` est une **décision** : elle change le comportement
de la plateforme sous le Worker. On la déplace en connaissance de cause, jamais
« pour être à jour ».
