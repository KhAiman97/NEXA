const LOCALE = "en-MY";

export function money(value: number | null | undefined, currency: string, digits = 2): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value ?? 0));
}

export function num(value: number | null | undefined, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value ?? 0));
}

/** "hardware_installment" -> "Hardware installment" */
export function label(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A calendar date (YYYY-MM-DD) has no timezone: format it as-is. */
function fromDay(day: string): Date {
  return new Date(`${day.slice(0, 10)}T00:00:00Z`);
}

export function day(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(fromDay(value));
}

export function dayWithYear(value: string | null | undefined): string {
  return day(value, { day: "numeric", month: "short", year: "numeric" });
}

export function longDay(value: string): string {
  return day(value, { weekday: "long", day: "numeric", month: "long" });
}

export function monthName(value: string): string {
  return day(value, { month: "short", year: "numeric" });
}

/** An instant shown in the user's timezone, e.g. "2 Oct". */
export function date(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** e.g. "6:15 pm" */
export function time(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** e.g. "2 Oct, 6:15 pm" */
export function dateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return `${date(iso, timeZone)}, ${time(iso, timeZone)}`;
}

/** Shift a calendar date by whole days. */
export function addDays(dayValue: string, days: number): string {
  const d = fromDay(dayValue);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromDay(to).getTime() - fromDay(from).getTime()) / 86_400_000);
}

export function percent(value: number, of: number): number {
  return of > 0 ? Math.round((value / of) * 100) : 0;
}
