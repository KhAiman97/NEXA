import { getSession } from "@/lib/app/session";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SignOutButton } from "./sign-out-button";

/**
 * Who is signed in, with the theme and sign-out controls. Shown at the top of every page:
 * `compact` is the phone header (initial and name only), the default adds the email.
 */
export async function Account({ compact = false }: { compact?: boolean }) {
  const { name, email } = await getSession();

  const avatar = (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground font-display text-sm font-semibold text-background">
      {name.charAt(0).toUpperCase()}
    </span>
  );

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-28 truncate text-sm font-medium" title={email}>
          {name}
        </span>
        {avatar}
        <div className="flex shrink-0 items-center">
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 text-right leading-tight">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      {avatar}
      <div className="flex shrink-0 items-center border-l pl-2">
        <ThemeSwitcher />
        <SignOutButton />
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return <div aria-hidden className="h-9 w-52 animate-pulse rounded-lg bg-muted" />;
}
