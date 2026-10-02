import type { PostgrestError } from "@supabase/supabase-js";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "duplicate"
  | "invalid_reference"
  | "constraint_violation"
  | "internal";

/** Safe-to-show error. Anything else thrown is logged server-side and masked as "internal". */
export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const PG_MAP: Record<string, [ErrorCode, string]> = {
  "23505": ["duplicate", "A record with these details already exists."],
  "23503": ["invalid_reference", "A linked record does not exist or was removed."],
  "23514": ["constraint_violation", "One of the values is out of the allowed range."],
  "23502": ["constraint_violation", "A required value is missing."],
  "22P02": ["validation_error", "A value has the wrong format."],
  "42501": ["forbidden", "You do not have access to this record."],
  PGRST116: ["not_found", "Record not found."],
};

/** Convert a PostgREST error into a ServiceError without leaking SQL details. */
export function fromPostgrest(error: PostgrestError): ServiceError {
  const mapped = PG_MAP[error.code];
  if (mapped) return new ServiceError(mapped[0], mapped[1]);
  console.error("[db]", error.code, error.message, error.details);
  return new ServiceError("internal", "Something went wrong. Please try again.");
}
