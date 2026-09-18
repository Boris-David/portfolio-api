import { z } from 'zod';
import { label, richText } from './text.js';

/**
 * A block of long-form body copy.
 *
 * A discriminated union rather than three optional fields: a body carries an
 * ordered run of typed blocks, and no invalid combination ("a paragraph *and*
 * a list, but in which order?") can be expressed at all.
 *
 * It lives on its own because it belongs to no single resource: a case-study
 * panel and a deep-dive section are both long-form body copy, and they must
 * render the same way on every client. Two block models would mean two
 * renderers per client, and a divergence the day one of them grows a case.
 */
export const BlockSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), text: richText() }),
    z.object({ type: z.literal('list'), items: z.array(richText()).min(1) }),
    z.object({ type: z.literal('tags'), items: z.array(label()).min(1) }),
  ])
  .meta({ id: 'Block' });

export type Block = z.infer<typeof BlockSchema>;
