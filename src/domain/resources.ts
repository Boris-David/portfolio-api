import type { z } from 'zod';
import {
  PART_SCHEMAS,
  PORTFOLIO_PARTS,
  PortfolioSchema,
  type Portfolio,
  type PortfolioPart,
} from './portfolio.js';
import { buildTimeline, TimelineSchema } from './timeline.js';

/**
 * A resource the API serves: the schema of its payload, and how that payload
 * is taken from the loaded content.
 *
 * `select` is what makes a resource a **view**. Every one of them reads the
 * same already-validated aggregate: some hand back a part untouched, one hands
 * back the whole thing, one recomputes a merge. None of them owns a store, so
 * none of them can hold a copy that goes stale.
 */
export interface ResourceView<T extends z.ZodType> {
  readonly schema: T;
  readonly select: (portfolio: Portfolio) => z.infer<T>;
}

type PartViews = { [K in PortfolioPart]: ResourceView<(typeof PART_SCHEMAS)[K]> };

/**
 * One view per part, built from the parts table itself.
 *
 * Listing them again by hand would be the correspondence table `PART_SCHEMAS`
 * exists to avoid: a part added to the schema and forgotten here would simply
 * stop being served, silently.
 */
const PART_VIEWS = Object.fromEntries(
  PORTFOLIO_PARTS.map((part) => [
    part,
    { schema: PART_SCHEMAS[part], select: (portfolio: Portfolio) => portfolio[part] },
  ]),
) as PartViews;

/**
 * Every read resource, in one table.
 *
 * The aggregate, each part, and the derived views sit side by side here on
 * purpose: the snapshot, the routes and the OpenAPI contract all iterate this
 * single table, so none of them carries a special case for one resource. A
 * resource that is not here is not served, and a resource that is here is
 * served, described and cached — there is no third state.
 */
export const RESOURCE_VIEWS = {
  portfolio: { schema: PortfolioSchema, select: (portfolio: Portfolio) => portfolio },
  ...PART_VIEWS,
  timeline: { schema: TimelineSchema, select: buildTimeline },
} satisfies Record<string, ResourceView<z.ZodType>>;

export type ResourceId = keyof typeof RESOURCE_VIEWS;

export const RESOURCES = Object.keys(RESOURCE_VIEWS) as readonly ResourceId[];
