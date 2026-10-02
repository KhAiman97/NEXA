import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromPostgrest, ServiceError } from "./errors";

/** Request-scoped, session-bound client. RLS is the authority; services never use a service-role key. */
export type Db = SupabaseClient;

export type Filter = Record<string, string | number | boolean | null | undefined>;

export type ListOptions = {
  filter?: Filter;
  /** Inclusive lower / exclusive upper bound on one column, e.g. a date range. */
  range?: { column: string; from?: string; to?: string };
  limit?: number;
  offset?: number;
};

type CrudConfig = {
  table: string;
  orderBy: string;
  ascending?: boolean;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Generic row-level CRUD for one table. user_id is never passed in: the column defaults to
 * auth.uid() and the RLS policy checks it, so a caller cannot write rows for someone else.
 */
export function createCrud<TRow extends { id: string }, TInsert extends object, TUpdate extends object = Partial<TInsert>>(
  config: CrudConfig,
) {
  const { table, orderBy, ascending = false } = config;

  return {
    table,

    async list(db: Db, options: ListOptions = {}): Promise<TRow[]> {
      const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const offset = Math.max(options.offset ?? 0, 0);

      let query = db.from(table).select("*").order(orderBy, { ascending }).range(offset, offset + limit - 1);

      for (const [column, value] of Object.entries(options.filter ?? {})) {
        if (value === undefined) continue;
        query = value === null ? query.is(column, null) : query.eq(column, value);
      }
      if (options.range?.from) query = query.gte(options.range.column, options.range.from);
      if (options.range?.to) query = query.lt(options.range.column, options.range.to);

      const { data, error } = await query;
      if (error) throw fromPostgrest(error);
      return (data ?? []) as TRow[];
    },

    async get(db: Db, id: string): Promise<TRow> {
      const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw fromPostgrest(error);
      if (!data) throw new ServiceError("not_found", "Record not found.");
      return data as TRow;
    },

    async create(db: Db, input: TInsert): Promise<TRow> {
      const { data, error } = await db.from(table).insert(input).select().single();
      if (error) throw fromPostgrest(error);
      return data as TRow;
    },

    async update(db: Db, id: string, patch: TUpdate): Promise<TRow> {
      const { data, error } = await db.from(table).update(patch).eq("id", id).select().maybeSingle();
      if (error) throw fromPostgrest(error);
      // RLS hides other users' rows, so "not yours" and "does not exist" look the same.
      if (!data) throw new ServiceError("not_found", "Record not found.");
      return data as TRow;
    },

    async remove(db: Db, id: string): Promise<void> {
      const { data, error } = await db.from(table).delete().eq("id", id).select("id");
      if (error) throw fromPostgrest(error);
      if (!data || data.length === 0) throw new ServiceError("not_found", "Record not found.");
    },
  };
}

/** Read from a view (or any relation) with simple equality filters. */
export async function selectView<T>(
  db: Db,
  view: string,
  options: { filter?: Filter; orderBy?: string; ascending?: boolean; limit?: number } = {},
): Promise<T[]> {
  let query = db.from(view).select("*");
  for (const [column, value] of Object.entries(options.filter ?? {})) {
    if (value === undefined) continue;
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  query = query.limit(Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const { data, error } = await query;
  if (error) throw fromPostgrest(error);
  return (data ?? []) as T[];
}
