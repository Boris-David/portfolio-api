# portfolio-api

La **source unique du contenu** du portfolio d'Amissan Amoussou-G., et le
**générateur du CV en PDF**.

Le web le consomme au build ; l'app iOS le consomme au runtime, en
offline-first. Les deux téléchargent le **même** CV — le même octet.

Décisions qui fondent ce dépôt :
[0002 — Une source unique de contenu](https://github.com/Boris-David/portfolio/blob/main/docs/adr/0002-source-unique-de-contenu.md) ·
[0003 — Choix des stacks](https://github.com/Boris-David/portfolio/blob/main/docs/adr/0003-choix-des-stacks.md) ·
[0004 — Le CV est généré par l'API](https://github.com/Boris-David/portfolio/blob/main/docs/adr/0004-le-cv-est-genere-par-l-api.md)

---

## Une seule définition, quatre dérivations

Le schéma Zod de `src/domain/` est la **seule** définition du contenu. Tout le
reste s'en déduit :

```
                       src/domain/*.ts   (schéma Zod)
                              │
        ┌─────────────┬───────┴────────┬──────────────────┐
        ▼             ▼                ▼                  ▼
  types TS       contrat OpenAPI   schéma des         gabarit du CV
  (z.infer)      (généré)          fichiers de        (consomme le
                                   contenu (dérivé)    modèle typé)
```

Rien n'est écrit deux fois, donc rien ne peut diverger. Le point le moins
évident est le troisième : les **fichiers de contenu sont bilingues** alors que
**l'API sert une langue résolue**. Ce sont deux formes du même modèle, et la
seconde se calcule à partir de la première (`src/content/derive.ts`) au lieu
d'être écrite à côté.

### Écrire du contenu

Trois primitives de texte, et ce qu'elles déclarent :

| Dans le schéma | Dans le fichier                           | Intention                                                      |
| -------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `prose()`      | `{ "fr": "…", "en": "…" }`                | une phrase — une traduction manquante est une faute            |
| `label()`      | `"Brest"` ou la paire                     | un terme court — identique dans les deux langues, sauf mention |
| `richText()`   | la paire, avec `**gras**` et `` `code` `` | une phrase à emphase                                           |

La distinction `prose` / `label` n'est pas cosmétique : sur une phrase, une
chaîne unique laisserait passer du français dans la charge utile anglaise ; sur
« Brest », exiger la paire ne protégerait rien et ferait 33 doublons.

L'emphase est écrite en balisage minimal et **servie en fragments typés**
(`[{ text, style }]`). Aucun client ne reçoit de HTML, et aucun client ne
réécrit d'analyseur — il n'en existe qu'un, ici.

Le contenu est chargé, validé et projeté **une fois, au démarrage**. Un contenu
invalide fait échouer le démarrage, jamais une requête de lecteur.

---

## Les endpoints

Toutes les ressources de lecture sont versionnées sous `/v1`, servies avec un
`ETag` fort et un `Cache-Control` revalidable.

| Route                                                                                                                       | Contenu                               |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `GET /v1/portfolio`                                                                                                         | tout, d'un seul appel                 |
| `GET /v1/profile` · `metrics` · `sections` · `case-studies` · `apps` · `expertise` · `experience` · `background` · `skills` | une partie                            |
| `GET /v1/cv/{fr\|en}.pdf`                                                                                                   | le CV rendu                           |
| `GET /v1/openapi.json`                                                                                                      | le contrat, généré depuis les schémas |
| `GET /health`                                                                                                               | l'état de l'instance                  |

**Langue.** `?lang=fr|en` s'il est donné, sinon `Accept-Language`, sinon le
français. Un `lang` inconnu est une **erreur** (`400`), pas un repli silencieux.
Les réponses portent `Content-Language` et `Vary: Accept-Language`.

**Enveloppe.** `{ "meta": { "locale", "contentVersion" }, "data": … }`. Les
en-têtes portent déjà la langue et l'`ETag` ; `meta` existe parce que l'app iOS
**écrit la réponse sur disque** comme instantané hors ligne, et qu'un instantané
qui ne porte pas sa version n'est pas vérifiable.

**ETag.** Les corps sont sérialisés et condensés au démarrage, pas à la requête.
Le contenu ne bouge pas pendant la vie du processus : recalculer à chaque appel
referait le même travail, et surtout empêcherait de comparer l'`ETag` _avant_ de
produire la réponse — un `304` coûterait alors le prix d'un `200`.

**Erreurs.** RFC 9457 (`application/problem+json`), documentées dans
[`docs/problems.md`](docs/problems.md).

---

## Le CV en PDF

### Ce que l'ADR 0004 impose

1. le rendu est déclenché par le **changement de contenu**, pas par la requête ;
2. le résultat est stocké et servi comme un **blob statique** validé par `ETag` ;
3. une version par langue ;
4. le gabarit doit **boire aux `tokens.json`** — sinon le PDF et le site
   divergent sur la forme, et on a seulement déplacé le problème.

### La technique retenue — Chromium sans interface, au build

**Pourquoi un navigateur.** Le point 4 est décisif. Un moteur PDF tiers
(`pdfkit`, `react-pdf`, un moteur LaTeX) obligerait à réécrire la mise en page
dans un autre modèle de boîte : deux moteurs, donc deux rendus qui divergent
lentement — exactement le risque que l'ADR nomme. Chromium met en page le CV
avec **le moteur qui met en page le site**. Les tokens produisent des variables
CSS, et il n'y a qu'un seul calcul de mise en page dans tout le système.

**Le poids de l'image et le démarrage à froid.** Ils ne sont pas payés, parce
que **le navigateur n'est jamais dans l'image qui sert** :

- Playwright est une dépendance de **développement** ;
- le `Dockerfile` a deux étages. L'étage _builder_ installe Chromium, rend les
  deux PDF, et est **jeté**. L'étage d'exécution est un `node:22-bookworm-slim`
  qui contient Node, le contenu et les PDF déjà rendus — pas un octet de
  navigateur ;
- une requête de lecture ne déclenche donc aucun rendu, et une instance Cloud
  Run qui se réveille n'a rien d'autre à lancer que Node. Le téléchargement du
  CV coûte une lecture mémoire.

C'est aussi ce qui rend le point 1 mécanique plutôt que déclaratif : le rendu ne
_peut pas_ arriver à la requête, puisque de quoi rendre n'est pas là.

**La garde anti-péremption.** Le rendu écrit un manifeste portant la version de
contenu. Au démarrage, l'API compare cette version à celle du contenu qu'elle
vient de charger. Si elles diffèrent — ou si l'artefact manque —, la route CV
répond `503` en disant quoi faire, et `/health` passe en `degraded`. Le contenu,
lui, continue d'être servi : un CV manquant ne doit pas couper le portfolio,
mais un CV périmé ne doit jamais être servi en silence.

**Les polices sont embarquées.** Un conteneur n'a ni Fraunces ni Instrument
Sans. Les sous-ensembles Latin, Latin étendu et la flèche `→` sont versionnés
dans `assets/fonts/` (≈ 170 Ko, licences OFL à côté) et injectés en `data:` dans
le document : le rendu ne dépend d'aucun réseau et donne le même résultat
partout. Provenance : Google Fonts, API `css2`, sous-ensembles `latin`,
`latin-ext` et `text=→`.

**Aucun carré vide.** Un caractère qu'aucune police embarquée ne dessine
produirait un carré vide dans le PDF — et un CV avec un carré vide est un CV
grillé. Le build refuse alors de rendre, en nommant les caractères fautifs.
C'est cette garde qui a fait apparaître le `→` de « Objective-C → Swift ».

**Le PDF reste lisible par une machine.** Les polices étant embarquées en
sous-ensembles, tout dépend de la table `ToUnicode` : sans elle, le document
serait parfait à l'œil et rendrait du charabia à l'extraction — donc perdu pour
un ATS. `pdftotext` rend aujourd'hui le CV entier, accents compris, et un test
empêche qu'un changement de gabarit ou de moteur casse ça en silence.

### Ce que le CV contient

Un CV n'est pas la page imprimée. La page déplie deux études de cas dont une en
cinq chantiers : les y reverser ferait six pages qu'aucun recruteur ne lit. La
sélection est **explicite dans `src/cv/model.ts`**, en code relisible, et ne
retire aucun fait du contenu — que l'API continue de servir entier.

Deux pages : identité, accroche, chiffres, expériences, profondeur technique,
compétences, formation, certifications, projets ouverts, inventaire des réseaux.

### Ce qui n'est pas déterministe

Chromium horodate le PDF, donc deux rendus d'un contenu identique ne sont pas
octet pour octet identiques, et l'`ETag` du CV change à chaque reconstruction.
C'est assumé : l'`ETag` est le condensat des octets réellement servis, donc il
est **toujours correct** ; il invalide seulement parfois pour rien. Le dériver de
la version de contenu le rendrait stable, mais alors une modification du
**gabarit** laisserait les caches sur l'ancien PDF. Correct d'abord.

---

## Les tokens de design — un instantané, pas une copie

`design/tokens.json` appartient au dépôt hub (ADR 0001). Ce dépôt doit se cloner
et se construire seul : il en porte donc un instantané, et `npm run check:tokens`
échoue s'il a dérivé de l'original — la comparaison se fait contre le hub voisin
quand il est là, contre `main` sur GitHub sinon. Même dispositif que
l'instantané embarqué côté iOS (ADR 0002) : une copie **gardée**, jamais une
seconde source de vérité.

---

## Lancer

Node 22 ou plus.

```sh
npm ci
npx playwright install chromium   # une fois — pour rendre le CV et jouer ses tests

npm run build:cv                  # rend artifacts/cv/*.pdf + le manifeste
npm run dev                       # http://localhost:8080
```

Sans `build:cv`, l'API démarre et sert le contenu ; seule la route CV répond
`503`, et `/health` l'annonce.

### Tests

```sh
npm test               # toute la suite, y compris un vrai rendu Chromium
npm run test:watch
npx vitest run tests/cv.test.ts   # un fichier
```

| Fichier                  | Ce qu'il garde                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `tests/markup.test.ts`   | la grammaire d'emphase et ses refus                                                                               |
| `tests/derive.test.ts`   | la dérivation du schéma bilingue, et son refus de laisser passer un noeud inconnu                                 |
| `tests/content.test.ts`  | le contenu réel : structure identique dans les deux langues, chiffres cohérents avec l'inventaire, liens en HTTPS |
| `tests/http.test.ts`     | langues, `ETag`, `304`, cache, erreurs, `503` du CV, `/health`                                                    |
| `tests/contract.test.ts` | les **octets servis** reparsés par le schéma publié, et le contrat figé à jour                                    |
| `tests/locale.test.ts`   | la négociation `Accept-Language` et la comparaison d'`ETag`                                                       |
| `tests/cv.test.ts`       | le modèle, le gabarit, la couverture des polices, et un rendu PDF réel                                            |

### Vérifications complètes

```sh
npm run format:check && npm run lint && npm run typecheck \
  && npm run check:openapi && npm run check:tokens && npm test && npm run build
```

C'est ce que joue la CI, à quoi s'ajoute la construction de l'image.

### Conteneur

```sh
docker build -t portfolio-api .
docker run --rm -p 8080:8080 portfolio-api
```

Le déploiement Cloud Run est **écrit mais pas branché** : aucun secret n'existe
encore. `.github/workflows/deploy.yml` liste en tête ce qu'il faudra fournir, et
ne se déclenche qu'à la main. L'authentification passera par **fédération
d'identité** — aucune clé de service dans un dépôt public.

---

## Structure

```
content/            les fichiers de contenu, bilingues, validés par le schéma
design/tokens.json  instantané des tokens du hub, gardé par check:tokens
assets/fonts/       les polices embarquées dans le PDF (OFL)
contracts/          le contrat OpenAPI dérivé, figé pour être relu en revue
docs/problems.md    les types d'erreur RFC 9457
src/
  domain/           le modèle et son schéma — aucune dépendance sortante
  content/          disque → domaine : dérivation, projection, instantané servi
  cv/               modèle du CV, gabarit, rendu, artefacts
  http/             routes, négociation de langue, erreurs, contrat
  config.ts         les valeurs nommées (cache, chemins, port)
  composition.ts    la racine de composition — le seul module qui lit le disque
scripts/            build du CV, du contrat, garde des tokens
tests/
```

---

**Contact** — amissan.ag@outlook.fr
