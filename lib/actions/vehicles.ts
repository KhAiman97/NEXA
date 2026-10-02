"use server";

import { run, parse } from "./run";
import { id, partialOf } from "@/lib/validators/common";
import { fuelLogInput, maintenanceInput, odometerInput, parkingInput, vehicleInput } from "@/lib/validators/vehicles";
import {
  fuelLogs, logFuel, logMaintenance, logParking, maintenanceLogs, odometerLogs, parkingLogs, vehicles,
} from "@/lib/services/vehicles";

// Logs can mirror into the finance ledger, so refresh both areas.
const V = ["/vehicles", "/finance"];

export async function createVehicle(input: unknown) { return run(({ db }) => vehicles.create(db, parse(vehicleInput, input)), V); }
export async function updateVehicle(vehicleId: unknown, patch: unknown) { return run(({ db }) => vehicles.update(db, parse(id, vehicleId), parse(partialOf(vehicleInput), patch)), V); }
export async function deleteVehicle(vehicleId: unknown) { return run(({ db }) => vehicles.remove(db, parse(id, vehicleId)), V); }

export async function createOdometerLog(input: unknown) { return run(({ db }) => odometerLogs.create(db, parse(odometerInput, input)), V); }
export async function updateOdometerLog(logId: unknown, patch: unknown) { return run(({ db }) => odometerLogs.update(db, parse(id, logId), parse(partialOf(odometerInput), patch)), V); }
export async function deleteOdometerLog(logId: unknown) { return run(({ db }) => odometerLogs.remove(db, parse(id, logId)), V); }

export async function createFuelLog(input: unknown) { return run(({ db }) => logFuel(db, parse(fuelLogInput, input)), V); }
export async function updateFuelLog(logId: unknown, patch: unknown) { return run(({ db }) => fuelLogs.update(db, parse(id, logId), parse(partialOf(fuelLogInput.omit({ record_expense: true })), patch)), V); }
export async function deleteFuelLog(logId: unknown) { return run(({ db }) => fuelLogs.remove(db, parse(id, logId)), V); }

export async function createMaintenanceLog(input: unknown) { return run(({ db }) => logMaintenance(db, parse(maintenanceInput, input)), V); }
export async function updateMaintenanceLog(logId: unknown, patch: unknown) { return run(({ db }) => maintenanceLogs.update(db, parse(id, logId), parse(partialOf(maintenanceInput.omit({ record_expense: true })), patch)), V); }
export async function deleteMaintenanceLog(logId: unknown) { return run(({ db }) => maintenanceLogs.remove(db, parse(id, logId)), V); }

export async function createParkingLog(input: unknown) { return run(({ db }) => logParking(db, parse(parkingInput, input)), V); }
export async function updateParkingLog(logId: unknown, patch: unknown) { return run(({ db }) => parkingLogs.update(db, parse(id, logId), parse(partialOf(parkingInput.omit({ record_expense: true })), patch)), V); }
export async function deleteParkingLog(logId: unknown) { return run(({ db }) => parkingLogs.remove(db, parse(id, logId)), V); }
