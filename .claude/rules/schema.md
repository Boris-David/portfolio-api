---
paths:
  - 'src/domain/**'
  - 'src/content/**'
---

# Le schéma et le chargement du contenu

> `src/domain/` est **la seule définition** du contenu. Les types TypeScript, le
> contrat OpenAPI, le schéma des fichiers et le gabarit du CV en dérivent.

## Le domaine ne dépend de rien

`src/domain/` n'importe que `zod`. Ni Hono, ni Playwright, ni `node:fs`. Une
importation sortante depuis le domaine est une erreur d'architecture, pas un
détail : c'est ce qui rend le modèle réutilisable et testable seul.

La documentation OpenAPI passe par `.meta({ id, description })` — la métadonnée
**native** de Zod. C'est ce qui permet au contrat d'être généré sans que le
domaine connaisse la bibliothèque qui le génère.

## Ajouter ou modifier un champ

1. Le déclarer dans `src/domain/`, avec `prose()`, `label()`, `richText()` ou
   une feuille non traduisible (`z.string()`, `z.url()`, `z.enum()`…).
2. Renseigner les fichiers de `content/` — les deux langues.
3. `npm run build:openapi` et committer le contrat régénéré **dans le même
   commit**. La CI échoue sinon, et à raison : une revue qui lit un contrat
   périmé ne revoit rien.
4. `npm test`.

Rien d'autre à toucher : le schéma des fichiers, la projection par langue, les
routes et le contrat suivent.

## La dérivation du schéma de fichiers

`src/content/derive.ts` calcule, depuis un schéma de domaine, le schéma bilingue
des fichiers. Elle reconnaît : objet, tableau, nullable, union (discriminée ou
non), et les feuilles `string` · `number` · `boolean` · `enum` · `literal`.

**Tout autre noeud lève.** C'est délibéré : un noeud ignoré en silence
produirait un schéma de fichier trop permissif, donc une validation qui ment. Si
le domaine a besoin d'un noeud de plus, on **ajoute sa prise en charge** ici —
on ne contourne pas.

La dérivation ne reproduit pas les contraintes des conteneurs (`array().min()`,
raffinements d'objet) : elles sont rattrapées par la **seconde validation** de la
valeur projetée contre le schéma de domaine, dans `loader.ts`. Les deux passes
sont complémentaires ; ne pas en supprimer une en croyant qu'elle fait double
emploi.

## Le chargement est fatal ou rien

Tout est lu, validé et projeté **une fois, au démarrage**, avant que le port ne
s'ouvre. Un contenu invalide fait échouer le démarrage : un portfolio à moitié
faux est pire qu'une API qui refuse de démarrer. Pas de mode dégradé, pas de
valeur de secours, pas de `try/catch` qui avale.

## L'instantané servi

`src/content/snapshot.ts` pré-sérialise et pré-condense chaque représentation.
Ne pas déplacer ce calcul dans le handler : la comparaison d'`ETag` doit pouvoir
se faire **avant** de produire la réponse, sinon un `304` coûte le prix d'un
`200`.
