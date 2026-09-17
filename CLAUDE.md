# portfolio-api — ce qui régit ce dépôt

> S'ajoute aux règles racines du workspace (périmètre, posture, workflow git,
> contenu éditorial). Sur la qualité, c'est toujours la barre la plus haute qui
> gagne.

Ce dépôt est **public** et lu par des recruteurs : le code fait partie du
produit. Il porte deux choses, et seulement deux — le **contenu** du portfolio,
et le **CV en PDF** qui s'en déduit.

## Les trois invariants du dépôt

### 1. Le schéma Zod est la seule définition

Les types TypeScript, le contrat OpenAPI, le schéma des fichiers de contenu et
le gabarit du CV en **dérivent**. Rien ne s'écrit deux fois.

- Ajouter un champ = le déclarer dans `src/domain/`, **et nulle part ailleurs**.
- Le contrat OpenAPI ne s'écrit jamais à la main. `npm run build:openapi` le
  régénère ; `npm run check:openapi` échoue s'il n'a pas été committé.
- Un fait dérivable ne se stocke pas. Le nombre d'applications se **compte** ;
  un compteur stocké est un second fait qui finit par mentir.

### 2. Bilingue de bout en bout, sans exception

Le contenu existe dans les deux langues ou il n'existe pas. `prose()` exige la
paire, `label()` accepte une chaîne nue qui vaut « identique dans les deux ».
Aucune ressource ne sort dans une seule langue, et une langue inconnue est une
erreur explicite — jamais un repli silencieux.

### 3. Le CV est rendu au build, jamais à la requête

C'est l'ADR 0004, et c'est mécanique : le navigateur n'existe que dans l'étage
_builder_ du `Dockerfile`. Un artefact absent ou périmé donne un `503` explicite
et un `/health` `degraded` — jamais un PDF servi en silence.

## Ce qu'on ne fait pas ici

| Geste                                                         | Pourquoi non                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| écrire ou retoucher `contracts/openapi.json` à la main        | il est **généré** ; le corriger, c'est le faire mentir                          |
| modifier `design/tokens.json`                                 | c'est un instantané du hub, qui en est propriétaire (ADR 0001)                  |
| stocker du HTML dans le contenu                               | le contenu n'appartient pas au web ; l'emphase se transporte en fragments typés |
| ajouter un texte non traduit                                  | voir l'invariant 2                                                              |
| inventer un fait, arrondir un chiffre, reformuler à la hausse | voir la règle éditoriale racine — chaque ligne y est un arbitrage rendu         |
| commiter les PDF rendus                                       | ce sont des artefacts de build (`artifacts/` est ignoré)                        |
| mettre une valeur de forme en dur dans le gabarit du CV       | elle doit venir des tokens, sinon le PDF et le site divergent                   |
| mettre un secret, une URL interne, un nom de module employeur | dépôt public, historique irréversible ; le hook de pre-commit refuse            |

## Avant de dire que c'est fait

```sh
npm run format:check && npm run lint && npm run typecheck \
  && npm run check:openapi && npm run check:tokens && npm test && npm run build
```

Vérifié **dans les logs**, jamais sur le code de retour d'un pipe. Un test qui
échoue se dit, avec sa sortie.

Un bug corrigé = un test qui aurait échoué avant le correctif.

## Où trouver le détail

Le fonctionnement, les choix et leur justification sont dans le
[README](README.md) — il est écrit pour un lecteur extérieur, et il fait foi.

Les règles de `.claude/rules/` sont **scopées par `paths:`** : elles se chargent
quand on touche la surface qu'elles régissent, et pas avant.

| Règle        | Se charge sur                                                |
| ------------ | ------------------------------------------------------------ |
| `contenu.md` | `content/**`                                                 |
| `schema.md`  | `src/domain/**`, `src/content/**`                            |
| `cv.md`      | `src/cv/**`, `scripts/build-cv.ts`, `design/**`, `assets/**` |
| `http.md`    | `src/http/**`                                                |
| `tests.md`   | `tests/**`                                                   |
