import { Suspense } from "react";
import { Account, AccountSkeleton } from "@/components/app/account";
import { Brand } from "@/components/app/brand";
import { BottomNav, SideNav } from "@/components/app/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desk min-h-svh bg-background lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 hidden h-svh flex-col gap-8 py-6 pl-5 lg:flex">
        <Brand className="self-start" />
        <SideNav />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Brand />
        <Suspense>
          <Account compact />
        </Suspense>
      </header>

      <main className="relative min-h-[calc(100svh-3.5rem)] overflow-clip border-t bg-sheet pb-24 lg:my-3 lg:mr-3 lg:min-h-[calc(100svh-1.5rem)] lg:rounded-2xl lg:border lg:pb-0">
        {/* Signed-in user, top right of every page (the phone header above carries the compact version). */}
        <div className="absolute right-8 top-7 z-10 hidden max-w-[45%] lg:block lg:right-10">
          <Suspense fallback={<AccountSkeleton />}>
            <Account />
          </Suspense>
        </div>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
