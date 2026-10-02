"use server";

import { run, parse } from "./run";
import { profileUpdate, updateProfile } from "@/lib/services/profile";

export async function saveProfile(input: unknown) {
  return run(({ db, userId }) => updateProfile(db, userId, parse(profileUpdate, input)), ["/", "/finance", "/nutrition"]);
}
