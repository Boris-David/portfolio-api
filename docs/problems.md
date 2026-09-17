# Types d'erreur

Les erreurs sont renvoyées au format **RFC 9457** (`application/problem+json`).
Le champ `type` est une URI stable qui pointe vers une section de cette page :
c'est **elle** qu'un client teste. Le champ `title` peut être reformulé, `detail`
change à chaque occurrence — ni l'un ni l'autre n'est un identifiant.

```json
{
  "type": "https://github.com/Boris-David/portfolio-api/blob/main/docs/problems.md#unsupported-locale",
  "title": "Langue non prise en charge",
  "status": 400,
  "detail": "« de » n'est pas une langue servie. Langues disponibles : fr, en."
}
```

## unsupported-locale

**400** — Le paramètre `lang` porte une valeur qui n'est pas une langue servie.

L'API ne retombe pas en silence sur le français : un client qui demande `de` doit
l'apprendre, pas recevoir du français en croyant avoir de l'allemand. Les langues
servies sont `fr` et `en`.

En l'absence de `lang`, l'API négocie depuis `Accept-Language` puis retombe sur
le français — c'est un défaut, pas une erreur.

## not-found

**404** — Aucune ressource à ce chemin.

La liste des ressources est dans le contrat : `GET /v1/openapi.json`.

## cv-unavailable

**503** — Aucun CV rendu ne correspond à la version de contenu servie.

Le CV est rendu **au build**, jamais à la requête (ADR 0004). Cette réponse
signifie que l'artefact manque, ou qu'il a été rendu pour un autre contenu. Dans
les deux cas, servir le PDF ferait mentir l'API — elle préfère le dire.

Le contenu, lui, reste servi normalement ; `GET /health` répond alors
`"status": "degraded"` en donnant la raison exacte.

Correction : `npm run build:cv`, puis redéployer. En production, le script du
Worker et les CV sont publiés **ensemble** depuis le même build, donc ce cas
suppose un déploiement lancé sans avoir re-rendu le CV — ce que la CI refuse.

## internal

**500** — L'API n'a pas pu traiter la requête.

Le détail n'est jamais renvoyé au client : la trace part dans les journaux de
l'instance. Une erreur de contenu, elle, ne produit pas ce cas — un contenu
invalide empêche l'instance de démarrer, avant que le port ne s'ouvre.
