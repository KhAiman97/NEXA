import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import {
  componentInput,
  inventoryItemInput,
  projectInput,
  type InventoryItem,
  type Project,
  type ProjectComponent,
} from "@/lib/validators/projects";

export const projects = createCrud<Project, z.infer<typeof projectInput>>({ table: "projects", orderBy: "created_at" });
export const inventory = createCrud<InventoryItem, z.infer<typeof inventoryItemInput>>({
  table: "inventory_items",
  orderBy: "name",
  ascending: true,
});

export type ProjectCostSummary = {
  project_id: string;
  user_id: string;
  name: string;
  expense_tag: string;
  status: Project["status"];
  budget: number | null;
  spent: number;
  budget_remaining: number | null;
  bom_value: number;
  bom_lines: number;
};

/** Spend per project from expenses tagged with project_id, plus the value of allocated parts. */
export function listProjectCosts(db: Db) {
  return selectView<ProjectCostSummary>(db, "project_cost_summary", { orderBy: "name" });
}

/** Items at or below their reorder level (and not sold/broken). */
export async function listLowStock(db: Db): Promise<InventoryItem[]> {
  const items = await inventory.list(db, { limit: 500 });
  return items.filter((i) => i.status !== "sold" && i.status !== "broken" && i.reorder_level > 0 && i.quantity <= i.reorder_level);
}

export type BomLine = ProjectComponent & { item: Pick<InventoryItem, "name" | "category" | "unit_cost" | "quantity"> };

export async function listComponents(db: Db, projectId: string): Promise<BomLine[]> {
  const { data, error } = await db
    .from("project_components")
    .select("*, item:inventory_items(name, category, unit_cost, quantity)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as unknown as BomLine[];
}

/** Add a part to a project's BOM, or change its quantity if it is already there. */
export async function setComponent(db: Db, input: z.infer<typeof componentInput>): Promise<ProjectComponent> {
  const { data, error } = await db.from("project_components").upsert(input, { onConflict: "project_id,item_id" }).select().single();
  if (error) throw fromPostgrest(error);
  return data as ProjectComponent;
}

export async function removeComponent(db: Db, id: string): Promise<void> {
  const { error } = await db.from("project_components").delete().eq("id", id);
  if (error) throw fromPostgrest(error);
}
