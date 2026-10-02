import { z } from "zod";
import * as c from "./common";
import type { RowOf } from "./finance";

export const projectInput = z.object({
  name: c.name,
  expense_tag: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Lowercase letters, numbers, - and _ only"),
  status: z.enum(["idea", "active", "paused", "done", "abandoned"]).default("idea"),
  description: c.optionalText,
  budget: c.money.nullish(),
  started_on: c.date.nullish(),
  completed_on: c.date.nullish(),
  colour: c.colour,
});

const ITEM_CATEGORIES = [
  "sbc", "microcontroller", "sensor", "module", "display", "power", "passive",
  "connector", "cable", "enclosure", "tool", "storage", "networking", "other",
] as const;

export const inventoryItemInput = z.object({
  name: c.name,
  category: z.enum(ITEM_CATEGORIES).default("other"),
  manufacturer: c.optionalText,
  model: c.optionalText,
  sku: c.optionalText,
  serial_number: c.optionalText,
  quantity: c.nonNegInt.default(1),
  reorder_level: c.nonNegInt.default(0),
  unit_cost: c.money.default(0),
  status: z.enum(["in_stock", "in_use", "reserved", "broken", "sold"]).default("in_stock"),
  location: c.optionalText,
  vendor: c.optionalText,
  product_url: z.url().nullish(),
  purchased_on: c.date.nullish(),
  warranty_until: c.date.nullish(),
  specs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  notes: c.optionalText,
  liability_id: c.optionalId,
});

export const componentInput = z.object({
  project_id: c.id,
  item_id: c.id,
  quantity: c.posInt.default(1),
  note: c.optionalText,
});

export type Project = RowOf<typeof projectInput>;
export type InventoryItem = RowOf<typeof inventoryItemInput>;
export type ProjectComponent = RowOf<typeof componentInput>;
