import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/utils/time";

const DEFAULT_CURRENCY = "MYR";
const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

/**
 * The signed-in user plus their display settings, resolved once per request (layout and page share it).
 * Accounts created before the profile trigger existed have no profile row, so settings fall back to defaults.
 */
export const getSession = cache(async () => {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect("/auth/login");

  const { data: profile } = await db.from("profiles").select("display_name, currency, timezone").eq("id", data.user.id).maybeSingle();

  const email = data.user.email ?? "";
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  return {
    db,
    userId: data.user.id,
    email,
    name: profile?.display_name?.trim() || email.split("@")[0] || "You",
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    timezone,
    /** Today's date (YYYY-MM-DD) in the user's timezone. */
    today: todayIn(timezone),
    hasProfile: profile != null,
  };
});

export type Session = Awaited<ReturnType<typeof getSession>>;
