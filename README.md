# portfolio-api

Source unique du contenu du portfolio. Le web le consomme au build ; l'app iOS
le consomme au runtime, en offline-first.

Voir la décision qui fonde ce découpage :
[ADR 0002 — Une source unique de contenu](https://github.com/Boris-David/portfolio/blob/main/docs/adr/0002-source-unique-de-contenu.md).

## `content/apps.json`

Les applications en production qui portent une contribution d'Amissan —
**36 au total** : 34 applications de transport dont la couche de billettique
mobile est de sa main, plus Mail Orange et KCalories.

Chaque `appStoreId` a été **vérifié un par un sur l'App Store** le 2026-09-17.
Trois identifiants trouvés en amont étaient périmés et un était dupliqué entre
deux réseaux ; ils ont été corrigés à la source.

Territoires couverts : France métropolitaine, Toscane (Italie), Polynésie
française.

> Ce fichier est de la **donnée dérivée et vérifiée**, pas une saisie manuelle.
> Toute reprise doit repasser par une vérification App Store — un identifiant
> mort sur un portfolio envoie le lecteur sur une page d'erreur.
