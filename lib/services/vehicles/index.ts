import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import { withLinkedExpense } from "../finance/transactions";
import {
  fuelLogInput,
  maintenanceInput,
  odometerInput,
  parkingInput,
  vehicleInput,
  type FuelLog,
  type FuelSegment,
  type MaintenanceLog,
  type OdometerLog,
  type ParkingLog,
  type Vehicle,
  type VehicleRunningCost,
} from "@/lib/validators/vehicles";

export const vehicles = createCrud<Vehicle, z.infer<typeof vehicleInput>>({ table: "vehicles", orderBy: "name", ascending: true });
export const odometerLogs = createCrud<OdometerLog, z.infer<typeof odometerInput>>({ table: "odometer_logs", orderBy: "logged_at" });
export const fuelLogs = createCrud<FuelLog, Omit<FuelLog, "id" | "user_id" | "created_at" | "updated_at">>({ table: "fuel_logs", orderBy: "filled_at" });
export const maintenanceLogs = createCrud<MaintenanceLog, Omit<MaintenanceLog, "id" | "user_id" | "created_at" | "updated_at">>({ table: "maintenance_logs", orderBy: "performed_on" });
export const parkingLogs = createCrud<ParkingLog, Omit<ParkingLog, "id" | "user_id" | "created_at" | "updated_at">>({ table: "parking_logs", orderBy: "started_at" });

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Fuel-up. total_cost defaults to liters × price; optionally mirrored into the ledger. */
export async function logFuel(db: Db, input: z.infer<typeof fuelLogInput>): Promise<FuelLog> {
  const { record_expense, total_cost, ...fill } = input;
  const cost = total_cost ?? round(fill.liters * fill.price_per_liter, 2);
  return withLinkedExpense(
    db,
    { title: `Fuel${fill.station ? ` – ${fill.station}` : ""}`, amount: cost, occurredAt: fill.filled_at, link: record_expense },
    (transactionId) => fuelLogs.create(db, { ...fill, total_cost: cost, transaction_id: transactionId }),
  );
}

export async function logMaintenance(db: Db, input: z.infer<typeof maintenanceInput>): Promise<MaintenanceLog> {
  const { record_expense, ...entry } = input;
  return withLinkedExpense(
    db,
    {
      title: `${entry.kind.replace(/_/g, " ")}${entry.workshop ? ` – ${entry.workshop}` : ""}`,
      amount: entry.cost,
      occurredAt: `${entry.performed_on}T00:00:00Z`,
      link: record_expense,
    },
    (transactionId) => maintenanceLogs.create(db, { ...entry, transaction_id: transactionId }),
  );
}

export async function logParking(db: Db, input: z.infer<typeof parkingInput>): Promise<ParkingLog> {
  const { record_expense, ...entry } = input;
  return withLinkedExpense(
    db,
    { title: `Parking${entry.location ? ` – ${entry.location}` : ""}`, amount: entry.cost, occurredAt: entry.started_at, link: record_expense },
    (transactionId) => parkingLogs.create(db, { ...entry, transaction_id: transactionId }),
  );
}

/** Per-vehicle fuel/maintenance/parking totals and cost per km (view `vehicle_running_costs`). */
export function listRunningCosts(db: Db) {
  return selectView<VehicleRunningCost>(db, "vehicle_running_costs", { orderBy: "name" });
}

/** Full-tank-to-full-tank efficiency segments, newest first. */
export function listFuelSegments(db: Db, vehicleId: string, limit = 24) {
  return selectView<FuelSegment>(db, "vehicle_fuel_segments", {
    filter: { vehicle_id: vehicleId },
    orderBy: "ended_at",
    ascending: false,
    limit,
  });
}

export type VehicleReminders = { overdueByDate: MaintenanceLog[]; dueByOdometer: MaintenanceLog[] };

/**
 * Maintenance reminders. Only the latest log of each kind counts, so an old oil change with a
 * lapsed due date is not flagged once a newer oil change has been logged.
 */
export async function listMaintenanceDue(db: Db, vehicleId: string, today: string): Promise<VehicleReminders> {
  const [logsResult, costs] = await Promise.all([
    db
      .from("maintenance_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("performed_on", { ascending: false })
      .order("created_at", { ascending: false }),
    selectView<VehicleRunningCost>(db, "vehicle_running_costs", { filter: { vehicle_id: vehicleId } }),
  ]);
  if (logsResult.error) throw fromPostgrest(logsResult.error);

  const latestByKind = new Map<string, MaintenanceLog>();
  for (const log of (logsResult.data ?? []) as MaintenanceLog[]) {
    if (!latestByKind.has(log.kind)) latestByKind.set(log.kind, log);
  }

  const odometer = costs[0]?.current_odometer_km;
  const latest = [...latestByKind.values()];
  return {
    overdueByDate: latest.filter((l) => l.next_due_on != null && l.next_due_on <= today),
    dueByOdometer: latest.filter((l) => odometer !== undefined && l.next_due_km != null && l.next_due_km <= odometer),
  };
}
