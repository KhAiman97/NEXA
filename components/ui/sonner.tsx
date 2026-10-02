"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts for saved / deleted / failed. Top of the screen, so the phone tab bar and install banner stay clear. */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      offset={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      mobileOffset={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-card !text-card-foreground !shadow-lg !font-sans",
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
