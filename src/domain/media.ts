import { z } from 'zod';
import { prose } from './text.js';

/**
 * A screenshot.
 *
 * The URL is not here: hosting the imagery is not part of this version.
 * Inventing a path that resolves to nothing would make the contract lie; the
 * client resolves `id` against its own asset set.
 *
 * `alt` and `caption` are two distinct texts and will stay that way: one
 * describes the image for whoever cannot see it, the other comments on it for
 * whoever can. Conflating them degrades both.
 */
export const MediaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    alt: prose(),
    caption: prose(),
  })
  .meta({ id: 'Media' });

export type Media = z.infer<typeof MediaSchema>;
