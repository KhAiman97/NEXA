import "server-only";
import type { z } from "zod";
import { createCrud, selectView, type Db } from "../crud";
import { fromPostgrest } from "../errors";
import { assetInput, type Asset, type AssetValuation, type valuationInput } from "@/lib/validators/finance";

export const assets = createCrud<Asset, z.infer<typeof assetInput>>({ table: "assets", orderBy: "name", ascending: true });

export type AssetWithValue = {
  asset_id: string;
  user_id: string;
  name: string;
  kind: Asset["kind"];
  amount_invested: number;
  current_value: number;
  valued_on: string | null;
};

export type NetWorth = { total_assets: number; total_liabilities: number; net_worth: number };

/** Active assets with their latest valuation (falls back to cost basis if never valued). */
export function listWithValues(db: Db) {
  return selectView<AssetWithValue>(db, "asset_latest_values", { orderBy: "name" });
}

export async function getNetWorth(db: Db): Promise<NetWorth> {
  const { data, error } = await db.from("net_worth").select("total_assets, total_liabilities, net_worth").maybeSingle();
  if (error) throw fromPostgrest(error);
  const n = (v: unknown) => Number(v ?? 0);
  return { total_assets: n(data?.total_assets), total_liabilities: n(data?.total_liabilities), net_worth: n(data?.net_worth) };
}

/** One valuation per asset per day: re-submitting the same day overwrites it. */
export async function upsertValuation(db: Db, input: z.infer<typeof valuationInput>): Promise<AssetValuation> {
  const { data, error } = await db.from("asset_valuations").upsert(input, { onConflict: "asset_id,valued_on" }).select().single();
  if (error) throw fromPostgrest(error);
  return data as AssetValuation;
}

export async function listValuations(db: Db, assetId: string): Promise<AssetValuation[]> {
  const { data, error } = await db.from("asset_valuations").select("*").eq("asset_id", assetId).order("valued_on", { ascending: true });
  if (error) throw fromPostgrest(error);
  return (data ?? []) as AssetValuation[];
}

export async function deleteValuation(db: Db, id: string): Promise<void> {
  const { error } = await db.from("asset_valuations").delete().eq("id", id);
  if (error) throw fromPostgrest(error);
}
