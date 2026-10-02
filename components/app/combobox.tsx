"use client";

import { useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { Option } from "@/lib/app/forms";
import { cn } from "@/lib/utils";

/**
 * A dropdown you can type into: typing narrows the list, arrow keys move through it, Enter picks.
 * The chosen option's value is submitted under `name` through a hidden input.
 *
 * `container` is the element the list is rendered into. Inside a dialog it must be the dialog itself,
 * otherwise the dialog's scroll lock stops the list from scrolling.
 */
export function Combobox({
  id,
  name,
  options,
  defaultValue = "",
  required = false,
  placeholder,
  container,
}: {
  id: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  container?: HTMLElement | null;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(() => (options.some((o) => o.value === defaultValue) ? defaultValue : ""));
  const selected = options.find((o) => o.value === value);
  const [text, setText] = useState(selected?.label ?? "");
  // Until something is typed the full list shows, even though the field holds the current choice.
  const [typed, setTyped] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const query = typed ? text.trim().toLowerCase() : "";
    return query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  }, [options, text, typed]);

  const show = () => {
    setTyped(false);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (option: Option) => {
    setValue(option.value);
    setText(option.label);
    setTyped(false);
    setOpen(false);
  };

  const clear = () => {
    setValue("");
    setText("");
    setTyped(false);
    inputRef.current?.focus();
  };

  /** Leaving the field with half-typed text: keep the last real choice (or nothing, if the text was wiped). */
  const settle = () => {
    setOpen(false);
    setTyped(false);
    if (text.trim() === "" && !required) {
      setValue("");
      setText("");
    } else {
      setText(selected?.label ?? "");
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (matches.length ? (i + step + matches.length) % matches.length : 0));
    } else if (event.key === "Enter") {
      // Enter picks from the open list instead of submitting the form.
      if (open) {
        event.preventDefault();
        if (matches[active]) pick(matches[active]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.stopPropagation();
        settle();
      }
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? show() : settle())}>
      <Popover.Anchor asChild>
        <div className="relative min-w-0">
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            required={required}
            placeholder={placeholder ?? (required ? "Choose…" : "None")}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setTyped(true);
              setActive(0);
              setOpen(true);
            }}
            // Focus alone does not open the list: a dialog focuses its first field as it opens.
            onClick={(event) => {
              if (open) return;
              event.currentTarget.select();
              show();
            }}
            onBlur={settle}
            onKeyDown={onKeyDown}
            className="h-10 w-full min-w-0 truncate rounded-lg border border-input bg-card pl-3 pr-16 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-ring md:text-sm"
          />
          <input type="hidden" name={name} value={value} />
          <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center gap-1 text-muted-foreground">
            {!required && value !== "" && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="Clear"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clear}
                className="pointer-events-auto rounded p-0.5 hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            )}
            <ChevronsUpDown aria-hidden className="size-4 opacity-60" />
          </div>
        </div>
      </Popover.Anchor>

      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // Clicking back into the field is not "outside".
            if (event.target instanceof Node && inputRef.current?.parentElement?.contains(event.target)) event.preventDefault();
          }}
          className="z-50 max-h-60 w-[--radix-popover-trigger-width] min-w-40 overflow-y-auto overscroll-contain rounded-lg border bg-card p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <ul id={listId} role="listbox">
            {matches.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">Nothing matches &ldquo;{text.trim()}&rdquo;</li>}
            {matches.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                // Keep focus in the field so the click lands before the blur handler runs.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
                className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm", index === active && "bg-accent")}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
