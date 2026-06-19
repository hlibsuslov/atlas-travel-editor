import { z } from 'zod';
import { MAX_YEAR, MIN_YEAR, TIMELINE_HINT } from './constants';
import { isValidTimelineString } from './timeline';

/**
 * The travel domain model, expressed once as Zod schemas.
 * Everything else (TypeScript types, UI validation, API validation, the
 * Postgres JSONB shape) is derived from this file — it is the single source
 * of truth for what a valid travel record looks like.
 */

export const yearSchema = z
  .number({ invalid_type_error: 'Year must be a number.' })
  .int('Year must be a whole number.')
  .min(MIN_YEAR, `Year must be >= ${MIN_YEAR}.`)
  .max(MAX_YEAR, `Year must be <= ${MAX_YEAR}.`);

export const timelineStringSchema = z
  .string()
  .trim()
  .refine(isValidTimelineString, { message: `Invalid format. Use ${TIMELINE_HINT}.` });

export const citySchema = z.object({
  name: z.string().trim().min(1, 'City name is required.'),
  timeline: z.object({
    visited: z.array(yearSchema),
  }),
});

export const countryStatusSchema = z.object({
  visited: z.boolean(),
  lived: z.boolean(),
  birthplace: z.boolean(),
});

export const countrySchema = z.object({
  name: z.string().trim().min(1, 'Country name is required.'),
  status: countryStatusSchema,
  capitalVisit: z.object({ visited: z.boolean() }),
  timeline: z.object({
    visited: z.array(timelineStringSchema),
    lived: z.array(timelineStringSchema),
  }),
  cities: z.array(citySchema),
});

export const travelDataSchema = z.object({
  person: z.object({
    birthplace: z.object({
      country: z.string().trim().min(1, 'Birthplace country is required.'),
    }),
  }),
  travel: z.object({
    countries: z.array(countrySchema),
  }),
});

export type Year = z.infer<typeof yearSchema>;
export type City = z.infer<typeof citySchema>;
export type CountryStatus = z.infer<typeof countryStatusSchema>;
export type Country = z.infer<typeof countrySchema>;
export type TravelData = z.infer<typeof travelDataSchema>;

/** Strict validation result, used by the UI to show all errors at once. */
export interface ValidationResult {
  ok: boolean;
  /** Flat, human-readable messages with a path prefix, e.g. "travel.countries.0.name: ...". */
  errors: string[];
}

/**
 * Validate a value against the strict schema and flatten errors into readable
 * messages. Does not throw.
 */
export function validateTravelData(value: unknown): ValidationResult {
  const result = travelDataSchema.safeParse(value);
  if (result.success) return { ok: true, errors: [] };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { ok: false, errors };
}
