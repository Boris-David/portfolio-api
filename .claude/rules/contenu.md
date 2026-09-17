---
paths:
  - 'content/**'
---

# Écrire dans `content/`

> Ces fichiers sont **la source unique** du portfolio. Ce qui est écrit ici sort
> tel quel sur le web, dans l'app iOS et sur le CV.

## Avant d'écrire une ligne

La règle éditoriale racine (`portfolio/.claude/rules/contenu-editorial.md`) fait
foi : chaque ligne y est un **arbitrage rendu par l'auteur**, souvent après une
première version rejetée. On n'y déroge pas, et on ne réintroduit jamais une
formulation qu'elle a explicitement refusée.

**On n'invente rien.** Pas un chiffre, pas un intitulé, pas une date, pas une
revendication. Un fait absent de la règle éditoriale ou de la matière validée ne
va nulle part. Une reformulation ne monte jamais d'un cran : « l'un des
référents » ne devient pas « le référent ».

## La forme des fichiers

Un fichier par partie du portfolio. Le nom se déduit du nom de la partie dans le
schéma (`caseStudies` → `case-studies.json`) : il n'y a **pas** de table de
correspondance à tenir.

| Dans le schéma | Ce qu'on écrit                            | Sens                                                                    |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `prose()`      | `{ "fr": "…", "en": "…" }`                | une phrase — les deux langues sont **obligatoires**                     |
| `label()`      | `"Brest"` **ou** `{ "fr": …, "en": … }`   | un terme court ; la chaîne nue vaut « identique dans les deux langues » |
| `richText()`   | la paire, avec `**gras**` et `` `code` `` | une phrase à emphase                                                    |

- Les clés `$comment` sont retirées avant validation : on peut commenter.
- Le schéma est **strict** : une clé inconnue est refusée. C'est voulu — c'est
  une faute de frappe, pas une extension.
- Pas de champ optionnel : une absence s'écrit `null`, explicitement.
- Le balisage se limite à `**gras**` et `` `code` ``, sans imbrication. Un
  délimiteur non fermé fait échouer le chargement en nommant la phrase.

## Ce qui ne se stocke pas

- **Un fait dérivable.** Le nombre d'applications se compte depuis
  `apps.json` ; un compteur stocké deviendrait faux au premier ajout.
- **Une date d'affichage.** On stocke `AAAA-MM` ; « mai 2023 → aujourd'hui » se
  formate au rendu, et « aujourd'hui » se périmerait tout seul.
- **Un numéro de section.** C'est le rang dans la liste.
- **Du HTML.** Le contenu n'appartient pas au web.
- **Un nom d'icône, une couleur, une taille.** C'est de la présentation.

## Un nombre écrit dans une phrase

Il est acceptable **uniquement s'il est gardé**. « 33 réseaux » figure dans deux
titres ; `tests/content.test.ts` vérifie qu'il correspond à l'inventaire réel.
Un nouveau nombre dans une phrase = une assertion de plus dans ce test, dans le
même commit.

## Après avoir modifié le contenu

```sh
npm test               # le contenu est validé et comparé dans les deux langues
npm run build:cv       # le CV dépend du contenu : il se re-rend
```

Un identifiant App Store ajouté se **vérifie sur l'App Store** avant d'être
committé, et `verifiedAt` se met à jour. Un identifiant mort envoie un recruteur
sur une page d'erreur.
