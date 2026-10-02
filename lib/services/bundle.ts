import "server-only";
import type { Db } from "./crud";
import { fromPostgrest } from "./errors";

/**
 * Call one of the page RPCs (supabase/migrations/20261002001100_page_bundles.sql). Each returns
 * everything a page needs as one jsonb document, so a page costs one round trip to the database
 * instead of one per list. They run as the caller, so RLS decides which rows come back.
 */
export async function callBundle<T>(db: Db, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw fromPostgrest(error);
  return data as T;
}
