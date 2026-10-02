"use server";

import { run, parse } from "./run";
import { id, partialOf } from "@/lib/validators/common";
import { componentInput, inventoryItemInput, projectInput } from "@/lib/validators/projects";
import { inventory, projects, removeComponent, setComponent } from "@/lib/services/projects";

const P = ["/projects"];

export async function createProject(input: unknown) { return run(({ db }) => projects.create(db, parse(projectInput, input)), P); }
export async function updateProject(projectId: unknown, patch: unknown) { return run(({ db }) => projects.update(db, parse(id, projectId), parse(partialOf(projectInput), patch)), P); }
export async function deleteProject(projectId: unknown) { return run(({ db }) => projects.remove(db, parse(id, projectId)), P); }

export async function createInventoryItem(input: unknown) { return run(({ db }) => inventory.create(db, parse(inventoryItemInput, input)), P); }
export async function updateInventoryItem(itemId: unknown, patch: unknown) { return run(({ db }) => inventory.update(db, parse(id, itemId), parse(partialOf(inventoryItemInput), patch)), P); }
export async function deleteInventoryItem(itemId: unknown) { return run(({ db }) => inventory.remove(db, parse(id, itemId)), P); }

export async function saveProjectComponent(input: unknown) { return run(({ db }) => setComponent(db, parse(componentInput, input)), P); }
export async function deleteProjectComponent(componentId: unknown) { return run(({ db }) => removeComponent(db, parse(id, componentId)), P); }
