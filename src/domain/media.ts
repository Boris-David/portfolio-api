import { z } from 'zod';
import { prose } from './text.js';

/**
 * Une capture d'écran.
 *
 * L'URL n'est pas ici : l'hébergement des visuels ne fait pas partie de cette
 * version. Inventer un chemin qui ne résout rien créerait un contrat faux ; le
 * client résout `id` contre son propre jeu d'assets.
 *
 * `alt` et `caption` sont deux textes distincts et le resteront : l'un décrit
 * l'image pour qui ne la voit pas, l'autre la commente pour qui la voit. Les
 * confondre dégrade les deux.
 */
export const MediaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    alt: prose(),
    caption: prose(),
  })
  .meta({ id: 'Media' });

export type Media = z.infer<typeof MediaSchema>;
