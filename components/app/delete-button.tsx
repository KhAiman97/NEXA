"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/run";

/** Two-step delete: the first click arms the button, the second one deletes. It disarms after a few seconds. */
export function DeleteButton({ id, what, action }: { id: string; what: string; action: (id: unknown) => Promise<ActionResult<unknown>> }) {
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const onClick = () => {
    if (!armed) {
      setFailed(false);
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await action(id);
      setArmed(false);
      if (result.error) {
        setFailed(true);
        toast.error(`Could not delete ${what}`, { description: result.error.message });
      } else {
        toast.success(`Deleted ${what}`);
        // The action already redraws the page; asking again makes sure the screen never shows the old list.
        router.refresh();
      }
    });
  };

  if (armed || pending || failed) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="shrink-0 rounded-md border border-neg/40 bg-neg/10 px-2 py-1 text-xs font-medium text-neg transition-colors hover:bg-neg/20 disabled:opacity-60"
      >
        {pending ? "Deleting…" : failed ? "Not deleted. Retry" : "Delete?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Delete ${what}`}
      title={`Delete ${what}`}
      className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-neg"
    >
      <Trash2 aria-hidden className="size-4" />
    </button>
  );
}
