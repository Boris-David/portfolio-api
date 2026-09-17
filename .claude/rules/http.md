---
paths:
  - 'src/http/**'
---

# La couche HTTP

## Le contrat n'est jamais écrit à la main

Les routes sont **déclarées** dans le registre OpenAPI avec les schémas du
domaine, et servies par des handlers ordinaires. `src/http/openapi.ts` ne porte
que les métadonnées du document — titre, version, licence, serveurs. **Aucun
schéma n'y est écrit.**

`npm run build:openapi` régénère `contracts/openapi.json`, qui se committe dans
le même commit que le changement de schéma. `npm run check:openapi` l'exige.

La conformité n'est pas vérifiée par le compilateur mais sur les **octets
réellement servis** (`tests/contract.test.ts`), ce qui est plus fort : c'est la
charge utile, pas une inférence de type, qui est reparsée par le schéma publié.

## Versionnement

Toutes les ressources de lecture vivent sous `/v1`. Un changement incompatible
crée `/v2` — on ne modifie pas `/v1` en place. `/health` est hors version : c'est
de l'exploitation, pas du contrat public.

## Langue

`?lang` s'il est donné, sinon `Accept-Language`, sinon le français. Un `lang`
inconnu renvoie `400` : **jamais** de repli silencieux, un client qui demande
`de` doit l'apprendre.

Toute réponse de contenu porte `Content-Language` **et** `Vary: Accept-Language`.
Sans `Vary`, un cache partagé servirait à un lecteur anglophone la réponse
française mise en cache juste avant.

## Cache et revalidation

`ETag` fort, calculé au démarrage sur le corps sérialisé. La comparaison avec
`If-None-Match` se fait **avant** de produire la réponse, et gère la liste, le
joker `*` et le préfixe faible `W/`.

Les valeurs de `Cache-Control` vivent dans `src/config.ts`. Aucune n'est écrite
dans un handler.

## Erreurs

RFC 9457 (`application/problem+json`), et rien d'autre. Un nouveau cas d'erreur
= une entrée dans `PROBLEMS` **et** une section dans `docs/problems.md` : le
champ `type` pointe dessus, et une URI de type qui ne résout rien est un contrat
cassé.

`detail` explique et dit quoi faire. Il ne remonte jamais de trace interne au
client.

## Injection

`createApp` reçoit ses dépendances, ne lit aucun fichier et n'appelle aucune
horloge. Ne pas introduire de lecture directe dans un handler — c'est ce qui
rend la couche HTTP testable sans environnement, et c'est aussi ce qui la rend
exécutable sur Workers, qui n'a pas de disque.

La dépendance CV est un **résolveur** `(Context) => CvStore`, et non une valeur :
sur Workers, le magasin d'assets n'existe que dans `c.env`, donc par requête. Un
test passe simplement un double.

Décrire un CV ne lit jamais ses octets : une revalidation n'a besoin que de
l'`ETag`, et télécharger 330 Ko pour répondre « vous l'avez déjà » serait
absurde.
