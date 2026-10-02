"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/actions/run";
import type { Field } from "@/lib/app/forms";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/app/combobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CONTROL = "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base transition-colors focus-visible:border-ring md:text-sm";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date / date-time strings in the shape <input type="date|datetime-local"> expects. */
function localNow(withTime: boolean): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

/** "21-17, 19-21" -> [{ my_score: 21, opponent_score: 17 }, ...] */
function parseScores(text: string) {
  return [...text.matchAll(/(\d+)\s*[-–:]\s*(\d+)/g)].map((m) => ({ my_score: Number(m[1]), opponent_score: Number(m[2]) }));
}

type Values = Record<string, unknown>;

/** An ISO instant as the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The value a control starts with: the stored value when editing, otherwise the field's default. */
function initialValue(field: Field, values: Values | undefined, openedAt: { date: string; dateTime: string }): string | number | undefined {
  if (values) {
    const stored = values[field.name];
    if (stored == null) return undefined;
    if (field.type === "datetime") return toLocalInput(String(stored));
    if (field.type === "date") return String(stored).slice(0, 10);
    if (field.type === "number") return Number(stored);
    return String(stored);
  }
  if (field.type === "date") return field.defaultValue === "now" ? openedAt.date : undefined;
  if (field.type === "datetime") return field.defaultValue === "now" ? openedAt.dateTime : undefined;
  return typeof field.defaultValue === "boolean" ? undefined : field.defaultValue;
}

/**
 * Turn the submitted form into the object the server action validates. When adding, empty optional
 * fields are left out. When editing, emptying a field that had a value clears it: fields with a
 * built-in default go back to that default, the rest are set to null.
 */
function toPayload(form: FormData, fields: Field[], fixed: Values, values?: Values): Values {
  const payload: Values = { ...fixed };
  for (const field of fields) {
    const raw = form.get(field.name);
    const text = typeof raw === "string" ? raw.trim() : "";
    const emptied = text === "" && values != null && values[field.name] != null && field.type !== "checkbox";
    if (emptied) {
      payload[field.name] = field.defaultValue != null && field.defaultValue !== "now" ? field.defaultValue : null;
      continue;
    }
    switch (field.type) {
      case "checkbox":
        payload[field.name] = raw === "on";
        break;
      case "ledger":
        if (raw === "on") payload[field.name] = {};
        break;
      case "number":
        if (text !== "") payload[field.name] = Number(text);
        break;
      case "datetime":
        if (text !== "") payload[field.name] = new Date(text).toISOString();
        break;
      case "scores":
        payload[field.name] = parseScores(text);
        break;
      default:
        if (text !== "") payload[field.name] = text;
    }
  }
  return payload;
}

function Control({ field, values, openedAt, container }: { field: Field; values?: Values; openedAt: { date: string; dateTime: string }; container: HTMLElement | null }) {
  const id = `field-${field.name}`;
  const common = { id, name: field.name, required: field.required };
  const initial = initialValue(field, values, openedAt);

  if (field.type === "select") {
    return <Combobox id={id} name={field.name} options={field.options ?? []} defaultValue={String(initial ?? "")} required={field.required} container={container} />;
  }
  if (field.type === "textarea") {
    return <textarea {...common} rows={3} placeholder={field.placeholder} defaultValue={initial} className={cn(CONTROL, "py-2")} />;
  }
  if (field.type === "number") {
    return <Input {...common} type="number" inputMode="decimal" step={field.step ?? "any"} min={field.min ?? 0} placeholder={field.placeholder} defaultValue={initial} />;
  }
  if (field.type === "date") return <Input {...common} type="date" className="min-w-0" defaultValue={initial} />;
  if (field.type === "datetime") return <Input {...common} type="datetime-local" className="min-w-0" defaultValue={initial} />;
  return <Input {...common} type="text" placeholder={field.placeholder} defaultValue={initial} />;
}

/**
 * A button that opens a form in a dialog and sends it to a server action.
 * The page describes the fields (see lib/app/forms.ts); the action validates them again on the server.
 *
 * Pass `action` to add a record. Pass `edit` and `update` to change an existing one: the trigger
 * becomes a pencil icon and the form opens filled with the record's current values.
 */
export function EntryDialog({
  label,
  description,
  fields: allFields,
  fixed = {},
  action,
  edit,
  update,
  variant = "default",
}: {
  /** Names the trigger and the dialog. When adding it is also the submit button's text. */
  label: string;
  description?: string;
  fields: Field[];
  /** Values sent with every submission that the user does not edit. */
  fixed?: Values;
  action?: (input: unknown) => Promise<ActionResult<unknown>>;
  /** The record being edited: its id and current values, keyed by field name. */
  edit?: { id: string; values: Values };
  update?: (id: unknown, patch: unknown) => Promise<ActionResult<unknown>>;
  variant?: "default" | "outline";
}) {
  // Linked expenses and game scores are set when a record is created and are not editable afterwards.
  const fields = edit ? allFields.filter((f) => f.type !== "ledger" && f.type !== "scores") : allFields;
  const [open, setOpen] = useState(false);
  // Dropdown lists render inside the dialog so its scroll lock does not block them.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [openedAt, setOpenedAt] = useState({ date: "", dateTime: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpenedAt({ date: localNow(false), dateTime: localNow(true) });
      setError(null);
    }
    setOpen(next);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(new FormData(event.currentTarget), fields, fixed, edit?.values);
    startTransition(async () => {
      const result = edit && update ? await update(edit.id, payload) : action ? await action(payload) : { error: { code: "internal" as const, message: "This form is not connected to anything." } };
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      toast.success(edit ? "Changes saved" : "Saved", { description: label });
      // The action already redraws the page; asking again makes sure the screen never shows the old values.
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {edit ? (
          <button type="button" aria-label={label} title={label} className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground">
            <Pencil aria-hidden className="size-4" />
          </button>
        ) : (
          <Button variant={variant} size="sm" className="h-9 px-3 text-sm">
            <Plus aria-hidden /> {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent ref={setContainer} className="flex max-h-[92svh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-visible rounded-2xl bg-sheet p-0 sm:rounded-2xl">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 px-6 pb-4 pr-12 pt-6 text-left">
            <DialogTitle className="font-display text-xl">{label}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-4 overflow-y-auto px-6 pb-5 pt-1">
            {fields.map((field) => {
              if (field.type === "checkbox" || field.type === "ledger") {
                return (
                  <label key={field.name} className="col-span-2 flex items-start gap-3 text-sm">
                    <input type="checkbox" name={field.name} defaultChecked={edit ? edit.values[field.name] === true : field.defaultValue === true} className="mt-0.5 size-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]" />
                    <span className="min-w-0">
                      {field.label}
                      {field.hint && <span className="block text-muted-foreground">{field.hint}</span>}
                    </span>
                  </label>
                );
              }
              // A date and time needs the full row: in half a row the picker icon covers the text.
              const half = field.half && field.type !== "datetime";
              return (
                <div key={field.name} className={cn("flex min-w-0 flex-col gap-1.5", half ? "col-span-2 sm:col-span-1" : "col-span-2")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor={`field-${field.name}`} className="truncate leading-normal">
                      {field.label}
                    </Label>
                    {!field.required && <span className="shrink-0 text-xs text-muted-foreground">Optional</span>}
                  </div>
                  <Control field={field} values={edit?.values} openedAt={openedAt} container={container} />
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="mx-6 mb-3 shrink-0 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">
              {error}
            </p>
          )}

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:space-x-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : edit ? "Save changes" : label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
