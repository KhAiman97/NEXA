import Image from "next/image";
import { Brand } from "@/components/app/brand";
import { BRAND } from "@/lib/pwa/icon";
import { MODULES, moduleStyle, type ModuleKey } from "@/lib/app/modules";

const CONTENTS: [ModuleKey, string][] = [
  ["finance", "Cashbooks, subscriptions, debts and net worth"],
  ["vehicles", "Fuel, servicing, parking and cost per kilometre"],
  ["fitness", "Daily goals, workouts, matches and range sessions"],
  ["nutrition", "Meals, water and caffeine against your goals"],
  ["projects", "Builds, budgets and the parts on your shelf"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-black lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* The logo is white on black, so this panel stays black (and uses the dark palette) in both themes. */}
      <aside className="dark hidden flex-col justify-between gap-10 bg-black p-10 text-foreground lg:flex xl:p-14">
        <Image src="/brand/logo.png" alt={BRAND.name} width={720} height={720} priority className="-ml-16 -mt-12 size-72 xl:size-80" />
        <ul className="flex max-w-md flex-col">
          {CONTENTS.map(([key, text]) => (
            <li key={key} style={moduleStyle(key)} className="flex items-center gap-4 border-t border-white/10 py-3.5 last:border-b">
              <span aria-hidden className="h-8 w-1.5 shrink-0 rounded-full bg-mod shadow-[0_0_12px_hsl(var(--mod)/0.7)]" />
              <span>
                <span className="block font-semibold">{MODULES[key].label}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Everything you record is visible to your account only.</p>
      </aside>

      <main className="flex items-center justify-center bg-sheet px-6 py-12 lg:my-3 lg:mr-3 lg:rounded-2xl">
        <div className="w-full max-w-sm">
          <Brand href="/auth/login" className="mb-12 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
