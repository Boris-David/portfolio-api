import { z } from 'zod';
import { label } from './text.js';

/**
 * La nature de la contribution portée dans l'application.
 *
 * - `ticketing` : la couche de billettique mobile y est embarquée ;
 * - `features`  : des fonctionnalités et des corrections dans l'application ;
 * - `end-to-end`: le produit entier, des quatre stacks à la publication.
 */
export const AppRoleSchema = z.enum(['ticketing', 'features', 'end-to-end']);

export type AppRole = z.infer<typeof AppRoleSchema>;

export const AppSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    territory: label(),
    appStoreId: z.string().regex(/^\d+$/),
    appStoreUrl: z.url(),
    role: AppRoleSchema,
  })
  .meta({ id: 'App' });

export type App = z.infer<typeof AppSchema>;

/**
 * L'inventaire des applications en production.
 *
 * `verifiedAt` date la dernière vérification des identifiants sur l'App Store.
 * Elle est portée par la donnée et non par un commentaire : un identifiant mort
 * envoie un recruteur sur une page d'erreur, et la fraîcheur de la
 * vérification fait partie de ce que la ressource promet.
 *
 * Le nombre d'applications ne figure **pas** ici : il se compte. Un compteur
 * stocké est un second fait à maintenir, donc un fait qui finit par mentir.
 */
export const AppInventorySchema = z
  .object({
    verifiedAt: z.iso.date(),
    items: z.array(AppSchema).min(1),
  })
  .meta({ id: 'AppInventory' });

export type AppInventory = z.infer<typeof AppInventorySchema>;

export function countByRole(inventory: AppInventory, role: AppRole): number {
  return inventory.items.filter((app) => app.role === role).length;
}
