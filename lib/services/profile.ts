import "server-only";
import { z } from "zod";
import type { Db } from "./crud";
import { fromPostgrest, ServiceError } from "./errors";
import { currency } from "@/lib/validators/common";

export const profileUpdate = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  currency: currency.optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone")
    .optional(),
});

export type Profile = { id: string; display_name: string | null; currency: string; timezone: string };

export async function getProfile(db: Db, userId: string): Promise<Profile> {
  const { data, error } = await db.from("profiles").select("id, display_name, currency, timezone").eq("id", userId).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new ServiceError("not_found", "Profile not found.");
  return data as Profile;
}

export async function updateProfile(db: Db, userId: string, patch: z.infer<typeof profileUpdate>): Promise<Profile> {
  const { data, error } = await db.from("profiles").update(patch).eq("id", userId).select("id, display_name, currency, timezone").maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw new ServiceError("not_found", "Profile not found.");
  return data as Profile;
}
