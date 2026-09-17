import { z } from 'zod';
import { MarkupError } from '../domain/errors.js';
import { UnsupportedSchemaNodeError } from '../domain/errors.js';
import type { Locale } from '../domain/locale.js';
import { parseMarkup } from '../domain/markup.js';
import { translatableKind } from '../domain/text.js';

/**
 * Dérive, depuis un schéma de domaine, le schéma des **fichiers de contenu**
 * pour une locale donnée.
 *
 * Le schéma de domaine décrit ce que l'API sert : une locale résolue, des
 * chaînes nues, du texte enrichi en spans. Les fichiers, eux, portent les deux
 * langues et le balisage d'auteur. Plutôt que d'écrire ce second schéma à la
 * main — ce qui recréerait exactement la divergence que l'ADR 0002 refuse —
 * on le **calcule** en remplaçant chaque feuille marquée traduisible par sa
 * forme bilingue, suivie de sa projection.
 *
 * Parser un fichier avec le schéma dérivé fait donc trois choses d'un coup :
 * valider la structure, vérifier qu'aucune traduction ne manque, et produire
 * directement la valeur de domaine pour la locale demandée.
 *
 * Ce que la dérivation **ne** reproduit pas — les contraintes portées par les
 * conteneurs (`array().min()`, raffinements d'objet) — est rattrapé par une
 * seconde validation de la valeur projetée contre le schéma de domaine
 * lui-même (`loader.ts`). Les deux passes sont complémentaires, et un bug de
 * dérivation devient une erreur bruyante au démarrage plutôt qu'une charge
 * utile silencieusement fausse.
 */
export function deriveContentSchema(schema: z.ZodType, locale: Locale, path = '$'): z.ZodType {
  const kind = translatableKind(schema);
  if (kind !== undefined) {
    switch (kind) {
      case 'prose':
        return localizedPair(NON_EMPTY, locale);
      case 'label':
        return localizedLabel(locale);
      case 'rich':
        return localizedRichText(locale);
    }
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const derived: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(shape)) {
      derived[key] = deriveContentSchema(value, locale, `${path}.${key}`);
    }
    // `strictObject` : une clé inconnue dans un fichier de contenu est une
    // faute de frappe, pas une extension. Elle doit échouer, pas être ignorée.
    return z.strictObject(derived);
  }

  if (schema instanceof z.ZodArray) {
    return z.array(deriveContentSchema(schema.element as z.ZodType, locale, `${path}[]`));
  }

  if (schema instanceof z.ZodNullable) {
    return deriveContentSchema(schema.unwrap() as z.ZodType, locale, path).nullable();
  }

  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    // Une union discriminée est dérivée en union simple : le discriminant est
    // un littéral non traduisible, donc exactement une branche peut encore
    // correspondre. Le schéma de domaine, lui, garde la forme discriminée —
    // c'est elle qui produit le contrat et les messages d'erreur.
    const options = (schema.options as readonly z.ZodType[]).map((option, index) =>
      deriveContentSchema(option, locale, `${path}|${String(index)}`),
    );
    return z.union(options);
  }

  if (LEAF_TYPES.has(schema.def.type)) {
    // Feuille non traduisible : identifiant, URL, date, énumération. Elle est
    // reprise telle quelle, avec ses contraintes.
    return schema;
  }

  throw new UnsupportedSchemaNodeError(schema.constructor.name, path);
}

/** Les types de feuille que le contenu a le droit de porter, sans traduction. */
const LEAF_TYPES = new Set(['string', 'number', 'boolean', 'enum', 'literal']);

const NON_EMPTY = z.string().min(1);

/**
 * Le balisage d'auteur : `**gras**` et `` `code` ``. Un délimiteur non fermé
 * remonte avec sa raison, à l'endroit exact du fichier — pas en « chaîne
 * invalide ».
 */
const MARKUP = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      parseMarkup(value);
    } catch (error) {
      if (!(error instanceof MarkupError)) throw error;
      ctx.addIssue({ code: 'custom', message: error.message });
    }
  });

function pair<T extends z.ZodType>(inner: T): z.ZodObject<{ fr: T; en: T }> {
  return z.strictObject({ fr: inner, en: inner });
}

function localizedPair(inner: z.ZodString, locale: Locale): z.ZodType<string> {
  return pair(inner).transform((value) => value[locale]);
}

function localizedLabel(locale: Locale): z.ZodType<string> {
  return z
    .union([NON_EMPTY, pair(NON_EMPTY)])
    .transform((value) => (typeof value === 'string' ? value : value[locale]));
}

function localizedRichText(locale: Locale): z.ZodType {
  return pair(MARKUP).transform((value) => parseMarkup(value[locale]));
}
