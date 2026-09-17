---
paths:
  - 'tests/**'
---

# Les tests

## Un bug corrigé = un test qui aurait échoué avant

Pas d'exception. Le test s'écrit **avant** le correctif quand c'est possible, et
il doit échouer sur le code fautif — un test qui passe des deux côtés ne garde
rien.

## Ce qu'un test vérifie ici

Le comportement observable, pas l'implémentation. Un test qui casse au moindre
renommage interne coûte plus qu'il ne protège.

Les tests de contenu et de contrat travaillent sur **le contenu réel** et sur
**les octets réellement servis**, pas sur des fixtures. C'est ce qui les rend
capables d'attraper une régression éditoriale, pas seulement une régression de
code.

## Le rendu du CV est testé pour de vrai

`tests/cv.test.ts` lance Chromium et rend les deux PDF. On ne remplace pas ce
rendu par un double : un test qui saute le moteur ne prouve rien sur ce que le
recruteur téléchargera. Le port `CvRenderer` existe pour l'architecture, pas
pour esquiver la vérification.

En revanche, les tests HTTP injectent une bibliothèque de CV fabriquée : ils
vérifient le **service** du blob, pas sa production.

## Les noms

Les intitulés disent le comportement garanti, en français, et se lisent comme
une phrase : « répond 304 quand le client présente l'ETag courant ». Pas de
« should », pas de nom de fonction dans le titre.

Quand une assertion garde une décision, le commentaire dit **pourquoi**, pas
quoi.

## Lancer

```sh
npm test
npx vitest run tests/cv.test.ts
```

Un échec se rapporte **avec sa sortie**. Jamais « les tests passent » sur un code
de retour de pipe.
