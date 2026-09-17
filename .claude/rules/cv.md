---
paths:
  - 'src/cv/**'
  - 'scripts/build-cv.ts'
  - 'design/**'
  - 'assets/**'
---

# Le CV en PDF

> Ce que l'ADR 0004 impose, et qui n'est pas négociable ici.

## Le rendu est déclenché par le contenu, jamais par la requête

Le navigateur n'existe que dans l'étage _builder_ du `Dockerfile` ; l'image qui
sert n'en contient pas un octet. Une requête de lecture ne peut donc pas
déclencher un rendu, et une instance qui se réveille n'a que Node à démarrer.

**Ne jamais** rendre à la volée dans un handler, même « en secours », même « en
dev ». Ce serait remettre le coût du démarrage du moteur sur le premier
téléchargement — précisément l'alternative que l'ADR a écartée.

Un artefact absent ou rendu pour une autre version de contenu donne un `503`
explicite et un `/health` `degraded`. Pas de PDF périmé servi en silence.

## Le gabarit boit aux tokens

Aucune couleur, aucune espace, aucun rayon, aucune taille écrite en dur dans
`template.ts`. Tout vient de `design/tokens.json`, converti en variables CSS.
C'est la condition posée par l'ADR : sinon le PDF et le site divergent sur la
forme, et on a seulement déplacé le risque de dérive.

La seule constante propre au support est `PRINT_DENSITY` — l'échelle des tokens
est calée sur le Dynamic Type d'iOS, trop généreuse pour une A4. Elle s'applique
en `calc()` partout, donc les **rapports** de l'échelle sont conservés.

`design/tokens.json` est un **instantané** du dépôt hub, qui en est propriétaire
(ADR 0001). On ne le modifie pas ici : on recopie l'original.
`npm run check:tokens` garde la copie.

## Les polices sont embarquées, et leur couverture est vérifiée

Un conteneur n'a aucune police installée. Les sous-ensembles sont versionnés
dans `assets/fonts/` et injectés en `data:` : aucun réseau au rendu, même
résultat partout.

La pile d'affichage retombe sur la police de **texte** avant tout générique : un
caractère absent de Fraunces doit être dessiné par une police embarquée, jamais
par une police système qui n'existe pas.

`assertCharactersAreCovered` fait **échouer le build** si le CV emploie un
caractère qu'aucune police embarquée ne dessine. Ne pas contourner cette garde :
un carré vide dans un CV est un CV grillé. La bonne réponse est d'ajouter le
sous-ensemble manquant (Google Fonts, paramètre `text=`), et de déclarer sa
plage dans `fonts.ts`.

Toute police ajoutée vient avec sa **licence** dans `assets/fonts/`.

## Le CV est une sélection, et elle est explicite

Un CV n'est pas la page imprimée. La sélection vit dans `src/cv/model.ts`, en
code relisible — jamais dissimulée dans le balisage du gabarit. Elle ne retire
aucun fait du contenu, que l'API continue de servir entier.

Les intitulés de section sont **lus dans le contenu** quand ils y sont. Seule la
charpente du document (« Profil », « Expérience »…) vit dans `labels.ts` : ce
n'est pas un fait du portfolio, c'est la structure d'un CV.

## Après avoir touché au gabarit ou au modèle

```sh
npm run build:cv
npm test
```

Et **regarder le PDF**. « Ça compile » ne dit rien d'une mise en page : vérifier
le nombre de pages, les coupures, et qu'aucun bloc ne laisse une demi-page
blanche.
