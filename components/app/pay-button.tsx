"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/run";
import { cn } from "@/lib/utils";

/**
 * "I have paid this": one tap records the payment as a transaction. Once the page reloads with the
 * payment in it, the row shows PaidTick instead of this button, so it cannot be recorded twice by accident.
 */
export function PayButton({ id, what, action, className }: { id: string; what: string; action: (id: unknown) => Promise<ActionResult<unknown>>; className?: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pay = () =>
    startTransition(async () => {
      const result = await action(id);
      if (result.error) toast.error(`Could not record ${what}`, { description: result.error.message });
      else {
        toast.success("Payment recorded", { description: `${what} is marked as paid for this month.` });
        router.refresh();
      }
    });

  return (
    <button
      type="button"
      onClick={pay}
      disabled={pending}
      className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-mod/50 bg-mod/10 px-2.5 text-xs font-medium text-mod transition-colors hover:bg-mod/20 disabled:opacity-60", className)}
    >
      {pending ? "Recording…" : "Mark paid"}
    </button>
  );
}

/** Shown in place of the button once this month has a payment. */
export function PaidTick({ on, className }: { on: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-pos", className)}>
      <CircleCheck aria-hidden className="size-4" /> Paid {on}
    </span>
  );
}
