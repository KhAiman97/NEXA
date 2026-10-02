"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/run";
import { cn } from "@/lib/utils";

/** One tap adds a fixed amount to a daily exercise goal (e.g. "+10" push-ups), stamped with the current time. */
export function QuickLogButton({
  goalId,
  amount,
  children,
  primary = false,
  action,
}: {
  goalId: string;
  amount: number;
  children: React.ReactNode;
  primary?: boolean;
  action: (input: unknown) => Promise<ActionResult<unknown>>;
}) {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const log = () =>
    startTransition(async () => {
      const result = await action({ goal_id: goalId, amount });
      setFailed(Boolean(result.error));
      if (result.error) toast.error("Not saved", { description: result.error.message });
      else toast.success(`Logged ${amount}`);
    });

  return (
    <button
      type="button"
      onClick={log}
      disabled={pending}
      title={failed ? "That was not saved. Tap to try again." : undefined}
      className={cn(
        "figure rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
        primary ? "border-mod bg-mod/10 text-mod hover:bg-mod/20" : "bg-card hover:border-mod hover:text-mod",
        failed && "border-neg text-neg",
      )}
    >
      {pending ? "Saving…" : failed ? "Retry" : children}
    </button>
  );
}
