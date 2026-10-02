import { z } from "zod";

export const id = z.uuid();
export const name = z.string().trim().min(1).max(200);
export const text = z.string().trim().max(2000);
export const optionalText = text.nullish();
export const optionalId = id.nullish();
export const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #3b82f6")
  .nullish();

/** Calendar date, YYYY-MM-DD. */
export const date = z.iso.date();
/** timestamptz as ISO-8601 with offset, e.g. 2026-10-02T09:30:00+08:00 */
export const timestamptz = z.iso.datetime({ offset: true });

/** Currency amount, rounded to 2dp to match numeric(14,2). */
export const money = z
  .number()
  .finite()
  .min(0)
  .max(999_999_999_999)
  .transform((n) => Math.round(n * 100) / 100);
export const positiveMoney = money.refine((n) => n > 0, "Must be greater than 0");

export const currency = z.string().length(3).toUpperCase();
export const nonNegInt = z.number().int().min(0);
export const posInt = z.number().int().positive();
export const nonNegNumber = z.number().finite().min(0);

/**
 * Update schema for a create schema. Plain `.partial()` is unsafe here: Zod 4 still applies
 * `.default()` values to omitted keys, so `{ name: "x" }` would also reset `kind`, `status`, etc.
 * to their defaults. This strips every default so an update only touches fields that were sent.
 */
export function partialOf<T extends z.ZodObject>(schema: T): z.ZodType<Partial<z.infer<T>>> {
  const strip = (field: z.ZodType): z.ZodType => (field instanceof z.ZodDefault ? strip(field.unwrap() as z.ZodType) : field);
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) shape[key] = strip(field as z.ZodType).optional();
  return z.object(shape) as unknown as z.ZodType<Partial<z.infer<T>>>;
}

export const idParam = z.object({ id });
export const monthStart = date.refine((d) => d.endsWith("-01"), "Must be the first day of a month");
