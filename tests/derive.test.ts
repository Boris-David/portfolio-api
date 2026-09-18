import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { deriveContentSchema } from '../src/content/derive.js';
import { UnsupportedSchemaNodeError } from '../src/domain/errors.js';
import { label, prose, richText } from '../src/domain/text.js';

describe('dérivation du schéma de contenu', () => {
  it('exige les deux langues sur une phrase, et projette celle demandée', () => {
    const schema = deriveContentSchema(z.object({ title: prose() }), 'en');

    expect(schema.parse({ title: { fr: 'Bonjour', en: 'Hello' } })).toEqual({ title: 'Hello' });
    expect(schema.safeParse({ title: { fr: 'Bonjour' } }).success).toBe(false);
    expect(schema.safeParse({ title: 'Bonjour' }).success).toBe(false);
  });

  it('accepte une chaîne nue sur un terme court, qui vaut pour les deux langues', () => {
    const schema = deriveContentSchema(z.object({ territory: label() }), 'en');

    expect(schema.parse({ territory: 'Brest' })).toEqual({ territory: 'Brest' });
    expect(schema.parse({ territory: { fr: 'Toscane', en: 'Tuscany' } })).toEqual({
      territory: 'Tuscany',
    });
  });

  it('convertit le balisage du texte enrichi en fragments typés', () => {
    const schema = deriveContentSchema(z.object({ body: richText() }), 'fr');

    expect(schema.parse({ body: { fr: 'Un **fait**', en: 'A **fact**' } })).toEqual({
      body: [
        { text: 'Un ', style: 'plain' },
        { text: 'fait', style: 'strong' },
      ],
    });
  });

  it("refuse un balisage cassé, dans la langue qui le porte comme dans l'autre", () => {
    const schema = deriveContentSchema(z.object({ body: richText() }), 'fr');
    const broken = { body: { fr: 'Un **fait', en: 'A **fact**' } };

    expect(schema.safeParse(broken).success).toBe(false);
  });

  it("refuse une clé inconnue : dans un fichier de contenu, c'est une faute de frappe", () => {
    const schema = deriveContentSchema(z.object({ slug: z.string() }), 'fr');

    expect(schema.safeParse({ slug: 'a', slgu: 'b' }).success).toBe(false);
  });

  it('laisse intactes les feuilles non traduisibles, contraintes comprises', () => {
    const schema = deriveContentSchema(z.object({ url: z.url() }), 'fr');

    expect(schema.parse({ url: 'https://example.org' })).toEqual({ url: 'https://example.org' });
    expect(schema.safeParse({ url: 'not-a-url' }).success).toBe(false);
  });

  it('traverse tableaux, nullables et unions', () => {
    const domain = z.object({
      intro: prose().nullable(),
      blocks: z.array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('paragraph'), text: richText() }),
          z.object({ type: z.literal('tags'), items: z.array(label()) }),
        ]),
      ),
    });
    const schema = deriveContentSchema(domain, 'en');

    expect(
      schema.parse({
        intro: null,
        blocks: [
          { type: 'paragraph', text: { fr: 'Salut', en: 'Hi' } },
          { type: 'tags', items: ['Swift'] },
        ],
      }),
    ).toEqual({
      intro: null,
      blocks: [
        { type: 'paragraph', text: [{ text: 'Hi', style: 'plain' }] },
        { type: 'tags', items: ['Swift'] },
      ],
    });
  });

  it("refuse de dériver un noeud qu'elle ne sait pas traduire, plutôt que de le laisser passer", () => {
    expect(() => deriveContentSchema(z.object({ when: z.date() }), 'fr')).toThrow(
      UnsupportedSchemaNodeError,
    );
  });
});
