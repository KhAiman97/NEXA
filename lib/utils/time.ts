/** Offset (ms) of `timeZone` from UTC at the instant `at`. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** [start, end) of a local calendar day (YYYY-MM-DD) as UTC ISO strings, for timestamptz range filters. */
export function zonedDayRange(day: string, timeZone: string): { from: string; to: string } {
  const [y, m, d] = day.split("-").map(Number);
  const startUtcGuess = Date.UTC(y, m - 1, d);
  const nextUtcGuess = Date.UTC(y, m - 1, d + 1);
  const from = new Date(startUtcGuess - tzOffsetMs(new Date(startUtcGuess), timeZone));
  const to = new Date(nextUtcGuess - tzOffsetMs(new Date(nextUtcGuess), timeZone));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Today's date (YYYY-MM-DD) in a given timezone. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** First day of the month containing `day` (YYYY-MM-DD). */
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}
