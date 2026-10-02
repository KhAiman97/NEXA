import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/utils/time";

const DEFAULT_CURRENCY = "MYR";
const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

type AppSession = { user_id: string | null; email: string | null; profile: { display_name: string | null; currency: string; timezone: string } | null };

/** Not signed in: no token (the anon role may not run the function) or one the Data API rejects. */
const SIGNED_OUT = new Set(["42501", "PGRST301", "PGRST302", "PGRST303"]);

/**
 * The signed-in user plus their display settings, resolved once per request (layout and page share it).
 * Accounts created before the profile trigger existed have no profile row, so settings fall back to defaults.
 */
export const getSession = cache(async () => {
  const db = await createClient();
  // One round trip for the user and their settings. The Data API checks the token's signature before the
  // function runs, so the id is from a verified token; the proxy has already refreshed an expiring one.
  const { data, error } = await db.rpc("app_session");
  if (error && !SIGNED_OUT.has(error.code)) throw new Error(`Could not load the session: ${error.message}`);
  const session = data as AppSession | null;
  if (error || !session?.user_id) redirect("/auth/login");
  const profile = session.profile;

  const email = session.email ?? "";
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  return {
    db,
    userId: session.user_id,
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
