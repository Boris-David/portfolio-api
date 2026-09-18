import { z } from 'zod';

/**
 * A fragment of text and its emphasis. This is the **transported** shape:
 * clients compose spans (a SwiftUI `Text`, a React `<strong>`) without ever
 * interpreting HTML or rewriting a markup parser.
 */
export const SpanStyleSchema = z.enum(['plain', 'strong', 'code']);

export type SpanStyle = z.infer<typeof SpanStyleSchema>;

export const SpanSchema = z
  .object({
    text: z.string().min(1),
    style: SpanStyleSchema,
  })
  .meta({
    id: 'Span',
    description: 'Fragment de texte et son emphase. « plain » = sans emphase.',
  });

export type Span = z.infer<typeof SpanSchema>;

export const RichTextSchema = z.array(SpanSchema).min(1).meta({
  id: 'RichText',
  description:
    'Texte enrichi découpé en fragments. La concaténation des « text » donne le texte nu.',
});

export type RichText = z.infer<typeof RichTextSchema>;
