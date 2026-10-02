import { z } from "zod";
import * as c from "./common";
import { ledgerLink, type RowOf } from "./finance";

export const vehicleInput = z.object({
  name: c.name,
  make: c.optionalText,
  model: c.optionalText,
  year: z.number().int().min(1950).max(2100).nullish(),
  plate_number: z.string().trim().toUpperCase().max(20).nullish(),
  fuel_type: z.enum(["ron95", "ron97", "diesel", "hybrid", "ev", "other"]).default("ron95"),
  tank_capacity_l: z.number().positive().max(1000).nullish(),
  initial_odometer_km: c.nonNegInt.default(0),
  purchased_on: c.date.nullish(),
  is_active: z.boolean().default(true),
});

export const odometerInput = z.object({
  vehicle_id: c.id,
  logged_at: c.timestamptz.default(() => new Date().toISOString()),
  odometer_km: c.nonNegInt,
  note: c.optionalText,
});

/** RON95 at the pump: the price the fill-up form starts with. */
export const DEFAULT_FUEL_PRICE = 1.99;

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * A fill-up is stored with both litres and cost, but the form asks for only one of them (the amount
 * paid, by default). Works out the missing one from the price per litre. With both given, both are kept.
 */
export function fillAmounts(input: { liters?: number | null; total_cost?: number | null; price_per_liter: number }): { liters: number; total_cost: number } | { error: string } {
  const { liters, total_cost: cost, price_per_liter: price } = input;
  if (liters == null && cost == null) return { error: "Enter the amount paid or the litres." };
  if (liters != null) return { liters, total_cost: cost ?? round(liters * price, 2) };
  if (!(price > 0)) return { error: "Enter the price per litre so the litres can be worked out." };
  const worked = round(cost! / price, 3);
  if (!(worked > 0)) return { error: "The amount paid must be more than 0." };
  if (worked > 1000) return { error: "That amount is too large for one fill-up." };
  return { liters: worked, total_cost: cost! };
}

export const fuelLogInput = z.object({
  vehicle_id: c.id,
  filled_at: c.timestamptz.default(() => new Date().toISOString()),
  odometer_km: c.nonNegInt,
  /** Litres or total_cost: one is enough, see fillAmounts. */
  liters: z.number().positive().max(1000).nullish(),
  price_per_liter: c.nonNegNumber.max(100).default(DEFAULT_FUEL_PRICE),
  total_cost: c.money.nullish(),
  is_full_tank: z.boolean().default(true),
  station: c.optionalText,
  fuel_grade: z.string().trim().max(50).nullish(),
  record_expense: ledgerLink,
});

const MAINTENANCE_KINDS = [
  "service", "oil_change", "tyres", "brakes", "battery", "repair",
  "inspection", "road_tax", "insurance", "accessories", "other",
] as const;
export const maintenanceInput = z.object({
  vehicle_id: c.id,
  performed_on: c.date.default(() => new Date().toISOString().slice(0, 10)),
  odometer_km: c.nonNegInt.nullish(),
  kind: z.enum(MAINTENANCE_KINDS).default("service"),
  description: c.optionalText,
  workshop: c.optionalText,
  cost: c.money.default(0),
  next_due_km: c.nonNegInt.nullish(),
  next_due_on: c.date.nullish(),
  record_expense: ledgerLink,
});

export const parkingInput = z.object({
  vehicle_id: c.id,
  started_at: c.timestamptz.default(() => new Date().toISOString()),
  ended_at: c.timestamptz.nullish(),
  authority: c.optionalText,
  location: c.optionalText,
  zone: c.optionalText,
  payment_method: c.optionalText,
  cost: c.money.default(0),
  note: c.optionalText,
  record_expense: ledgerLink,
});

export type Vehicle = RowOf<typeof vehicleInput>;
export type OdometerLog = RowOf<typeof odometerInput>;
export type FuelLog = Omit<RowOf<typeof fuelLogInput>, "record_expense"> & { liters: number; total_cost: number; transaction_id: string | null };
export type MaintenanceLog = Omit<RowOf<typeof maintenanceInput>, "record_expense"> & { transaction_id: string | null };
export type ParkingLog = Omit<RowOf<typeof parkingInput>, "record_expense"> & { transaction_id: string | null };

export type FuelSegment = {
  user_id: string;
  vehicle_id: string;
  start_odometer_km: number;
  end_odometer_km: number;
  ended_at: string;
  distance_km: number;
  liters: number;
  cost: number;
  km_per_liter: number | null;
  liters_per_100km: number | null;
  fuel_cost_per_km: number | null;
};

export type VehicleRunningCost = {
  user_id: string;
  vehicle_id: string;
  name: string;
  fuel_cost: number;
  maintenance_cost: number;
  parking_cost: number;
  total_cost: number;
  current_odometer_km: number;
  distance_km: number;
  cost_per_km: number | null;
};
