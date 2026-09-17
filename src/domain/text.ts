import { z } from 'zod';
import { RichTextSchema } from './rich-text.js';

/**
 * Les trois primitives de texte du modèle, et ce qu'elles déclarent.
 *
 * Le schéma écrit ici est celui que **l'API sert** : une locale résolue, des
 * chaînes nues. Le schéma des **fichiers de contenu** — bilingue — s'en dérive
 * mécaniquement (`src/content/derive.ts`) à partir des marques posées ci-dessous.
 * Une seule déclaration, donc, pour le modèle, le contrat OpenAPI, les types
 * TypeScript et la validation du contenu.
 *
 * | primitive   | ce que l'auteur écrit dans le fichier | intention               |
 * |-------------|---------------------------------------|-------------------------|
 * | `prose()`   | `{ "fr": "…", "en": "…" }` obligatoire | de la phrase : une traduction manquante est une faute |
 * | `label()`   | `"Brest"` **ou** la paire             | un terme court : identique dans les deux langues, sauf mention contraire |
 * | `richText()`| la paire, avec `**gras**` et `` `code` `` | de la phrase à emphase |
 *
 * La distinction `prose` / `label` n'est pas cosmétique : elle met l'invariant
 * là où il compte. Sur une phrase, une chaîne unique passerait silencieusement
 * du français dans la charge utile anglaise. Sur « Brest », exiger la paire ne
 * protégerait rien et ferait 33 doublons.
 */
export type TranslatableKind = 'prose' | 'label' | 'rich';

const marks = new WeakMap<z.ZodType, TranslatableKind>();

function mark<T extends z.ZodType>(schema: T, kind: TranslatableKind): T {
  marks.set(schema, kind);
  return schema;
}

/** La marque de traduisibilité d'un noeud, si elle existe. */
export function translatableKind(schema: z.ZodType): TranslatableKind | undefined {
  return marks.get(schema);
}

const PROSE = mark(z.string().min(1), 'prose');
const LABEL = mark(z.string().min(1), 'label');
const RICH = mark(RichTextSchema, 'rich');

/** Une phrase. Les deux langues sont obligatoires côté fichier. */
export function prose(): z.ZodString {
  return PROSE;
}

/** Un terme court. Une chaîne nue vaut « identique dans les deux langues ». */
export function label(): z.ZodString {
  return LABEL;
}

/** Une phrase à emphase, transportée en spans. */
export function richText(): typeof RichTextSchema {
  return RICH;
}
