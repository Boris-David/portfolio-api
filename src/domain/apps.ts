import { z } from 'zod';
import { label } from './text.js';

/**
 * The nature of the contribution made to the app.
 *
 * - `ticketing`  : the mobile ticketing layer is embedded in it;
 * - `features`   : features and fixes inside the app;
 * - `end-to-end` : the whole product, from the four stacks to release.
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
 * The inventory of apps in production.
 *
 * `verifiedAt` dates the last time the identifiers were checked against the
 * App Store. It is carried by the data and not by a comment: a dead identifier
 * sends a recruiter to an error page, and how fresh that check is belongs to
 * what the resource promises.
 *
 * The number of apps is **not** here: it is counted. A stored counter is a
 * second fact to maintain, and therefore a fact that ends up lying.
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
