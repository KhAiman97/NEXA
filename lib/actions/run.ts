import "server-only";
import { refresh, revalidatePath } from "next/cache";
import { ZodError, type ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/services/crud";
import { ServiceError, type ErrorCode } from "@/lib/services/errors";

/** Every server action returns this shape: `{ data }` or `{ error: { code, message } }`. */
export type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: ErrorCode; message: string } };

type Ctx = { db: Db; userId: string };

/** Validate untrusted input (server actions are public endpoints). Unknown keys are stripped. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  throw new ServiceError("validation_error", `${where}${issue.message}`);
}

/**
 * Wraps one action: authenticates with getUser() (verified against Supabase, not just the cookie),
 * runs `fn` with a session-bound client, refreshes what the browser shows, and converts failures into safe errors.
 */
export async function run<T>(fn: (ctx: Ctx) => Promise<T>, revalidate: string[] = []): Promise<ActionResult<T>> {
  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) throw new ServiceError("unauthorized", "Please sign in to continue.");

    const result = await fn({ db, userId: data.user.id });
    for (const path of revalidate) revalidatePath(path);
    // Every page shows per-user data that one change can touch (a fuel fill is also an expense, a payment
    // moves net worth), so drop everything the browser is holding and redraw the page being looked at
    // in this same response. Nothing here is cached on the server, so this costs no extra work.
    revalidatePath("/", "layout");
    refresh();
    return { data: result };
  } catch (err) {
    if (err instanceof ServiceError) return { error: { code: err.code, message: err.message } };
    if (err instanceof ZodError) return { error: { code: "validation_error", message: err.issues[0]?.message ?? "Invalid input." } };
    console.error("[action]", err);
    return { error: { code: "internal", message: "Something went wrong. Please try again." } };
  }
}
