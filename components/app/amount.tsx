"use client";

import { useEffect, useState } from "react";
import NumberFlow, { type Format } from "@number-flow/react";

/**
 * A headline number that rolls up to its value when it appears (NumberFlow skips the motion for
 * people who ask for reduced motion). Pass `currency` for money, or `unit` for a plain suffix.
 */
export function Amount({ value, currency, digits = currency ? 2 : 0, unit }: { value: number; currency?: string; digits?: number; unit?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(value), [value]);

  const format: Format = currency
    ? { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }
    : { minimumFractionDigits: digits, maximumFractionDigits: digits };

  return <NumberFlow value={shown} locales="en-MY" format={format} suffix={unit ? ` ${unit}` : undefined} />;
}
