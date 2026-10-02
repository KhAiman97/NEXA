import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest, ServiceError } from "../errors";
import { callBundle } from "../bundle";
import { withLinkedExpense } from "../finance/transactions";
import {
  fillAmounts,
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

/** Litres and cost for a fill-up, or a validation error the form can show. */
function amountsOrThrow(input: Parameters<typeof fillAmounts>[0]) {
  const amounts = fillAmounts(input);
  if ("error" in amounts) throw new ServiceError("validation_error", amounts.error);
  return amounts;
}

/** Fuel-up. Give the amount paid or the litres: the other comes from the price. Optionally mirrored into the ledger. */
export async function logFuel(db: Db, input: z.infer<typeof fuelLogInput>): Promise<FuelLog> {
  const { record_expense, ...fill } = input;
  const { liters, total_cost } = amountsOrThrow(fill);
  return withLinkedExpense(
    db,
    { title: `Fuel${fill.station ? ` – ${fill.station}` : ""}`, amount: total_cost, occurredAt: fill.filled_at, link: record_expense },
    (transactionId) => fuelLogs.create(db, { ...fill, liters, total_cost, transaction_id: transactionId }),
  );
}

/**
 * Edit a fill-up, keeping litres, cost and price consistent. Whichever of litres and cost was changed
 * (or left in place when the other was cleared) is kept and the other is worked out again. When only
 * the price changes, the amount paid is the fact and the litres follow it.
 */
export async function updateFuel(db: Db, id: string, patch: Partial<Omit<z.infer<typeof fuelLogInput>, "record_expense">>): Promise<FuelLog> {
  const current = await fuelLogs.get(db, id);
  const price = patch.price_per_liter ?? Number(current.price_per_liter);
  const changed = (next: number | null | undefined, was: number) => next !== undefined && (next === null || Number(next) !== Number(was));
  const litersChanged = changed(patch.liters, current.liters);
  const costChanged = changed(patch.total_cost, current.total_cost);
  const priceChanged = price !== Number(current.price_per_liter);

  let amounts: { liters: number; total_cost: number } | null = null;
  if (litersChanged && costChanged) amounts = amountsOrThrow({ liters: patch.liters, total_cost: patch.total_cost, price_per_liter: price });
  else if (litersChanged) amounts = amountsOrThrow(patch.liters == null ? { total_cost: Number(current.total_cost), price_per_liter: price } : { liters: patch.liters, price_per_liter: price });
  else if (costChanged) amounts = amountsOrThrow(patch.total_cost == null ? { liters: Number(current.liters), price_per_liter: price } : { total_cost: patch.total_cost, price_per_liter: price });
  else if (priceChanged) amounts = amountsOrThrow({ total_cost: Number(current.total_cost), price_per_liter: price });

  const { liters: _liters, total_cost: _cost, ...rest } = patch;
  void _liters;
  void _cost;
  return fuelLogs.update(db, id, amounts ? { ...rest, ...amounts } : rest);
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
 * Maintenance reminders from the latest log of each kind, so an old oil change with a lapsed
 * due date is not flagged once a newer oil change has been logged.
 */
export function remindersFrom(latestOfEachKind: MaintenanceLog[], odometer: number | undefined, today: string): VehicleReminders {
  return {
    overdueByDate: latestOfEachKind.filter((l) => l.next_due_on != null && l.next_due_on <= today),
    dueByOdometer: latestOfEachKind.filter((l) => odometer !== undefined && l.next_due_km != null && l.next_due_km <= odometer),
  };
}

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
  return remindersFrom([...latestByKind.values()], costs[0]?.current_odometer_km, today);
}

export type VehiclesPage = {
  vehicles: Vehicle[];
  costs: VehicleRunningCost[];
  fuel: FuelLog[];
  maintenance: MaintenanceLog[];
  parking: ParkingLog[];
  /** Odometer readings, newest first. */
  odometer: OdometerLog[];
  /** Per vehicle: its latest 12 fuel segments (newest first) and what is due. */
  details: Map<string, { segments: FuelSegment[]; due: VehicleReminders }>;
};

type VehiclesBundle = Omit<VehiclesPage, "details" | "odometer"> & { odometer?: OdometerLog[]; segments: FuelSegment[]; latest_services: MaintenanceLog[] };

/**
 * Everything the Vehicles page shows, in one round trip (the vehicles_bundle RPC). This also covers
 * what used to be three follow-up requests per vehicle for fuel segments and reminders.
 */
export async function loadVehiclesPage(db: Db, today: string): Promise<VehiclesPage> {
  const { segments, latest_services, ...lists } = await callBundle<VehiclesBundle>(db, "vehicles_bundle");
  const odometerOf = new Map(lists.costs.map((c) => [c.vehicle_id, c.current_odometer_km]));
  const details = new Map(
    lists.vehicles.map((v) => [
      v.id,
      {
        segments: segments.filter((s) => s.vehicle_id === v.id),
        due: remindersFrom(latest_services.filter((m) => m.vehicle_id === v.id), odometerOf.get(v.id), today),
      },
    ]),
  );
  // `?? []`: if the database function is a version behind the app, the page still loads, just without readings.
  return { ...lists, odometer: lists.odometer ?? [], details };
}
