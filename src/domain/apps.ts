import { z } from 'zod';
import { label, prose } from './text.js';

/**
 * The nature of the contribution made to the app.
 *
 * - `ticketing`  : the mobile ticketing layer is embedded in it;
 * - `features`   : features and fixes inside the app;
 * - `end-to-end` : the whole product, from the four stacks to release.
 */
export const AppRoleSchema = z.enum(['ticketing', 'features', 'end-to-end']);

export type AppRole = z.infer<typeof AppRoleSchema>;

/**
 * One app, and the ways a reader can reach it.
 *
 * Both links are nullable, and for opposite reasons. An app shipped inside
 * somebody else's product is on the App Store and has no public source; an app
 * of the author's own can be readable long before it is downloadable. Requiring
 * an App Store identifier would have meant either leaving his own work out of
 * the inventory, or inventing one — so the pair is optional and the surfaces
 * show whichever link exists.
 *
 * `null` is written explicitly: an absent key would be a typo, a `null` is a
 * statement.
 */
export const AppSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    territory: label(),
    appStoreId: z.string().regex(/^\d+$/).nullable(),
    appStoreUrl: z.url().nullable(),
    /** The public repository, when the code is open. */
    sourceUrl: z.url().nullable(),
    /**
     * One sentence on what the app is — for an app with no case study.
     *
     * `null` where a case study already says it: the study's subtitle is the
     * better sentence and duplicating it would be a second copy to keep in
     * step. So this is not "a description field nobody filled in", it is the
     * fallback for the apps that have no longer story to tell.
     */
    summary: prose().nullable(),
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
