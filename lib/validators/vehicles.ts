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

export const fuelLogInput = z.object({
  vehicle_id: c.id,
  filled_at: c.timestamptz.default(() => new Date().toISOString()),
  odometer_km: c.nonNegInt,
  liters: z.number().positive().max(1000),
  price_per_liter: c.nonNegNumber.max(100),
  /** If omitted it is computed as liters × price_per_liter. */
  total_cost: c.money.optional(),
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
export type FuelLog = Omit<RowOf<typeof fuelLogInput>, "record_expense"> & { total_cost: number; transaction_id: string | null };
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
