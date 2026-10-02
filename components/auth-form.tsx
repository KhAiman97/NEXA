import type { ReactNode } from "react";

/** Shared heading and spacing for the sign-in, sign-up and password screens. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-2 text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">
      {message}
    </p>
  );
}
