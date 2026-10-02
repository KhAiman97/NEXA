"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Underlined tabs that split a module's page into views. Each view's content is rendered on the server. */
export function ModuleTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.id}>
      <div className="-mx-5 overflow-x-auto border-b px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <TabsList className="h-auto justify-start gap-6 rounded-none bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative rounded-none px-0 pb-3 pt-1 text-[15px] font-medium text-muted-foreground shadow-none transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full hover:text-foreground focus-visible:ring-offset-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-mod"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-8 flex flex-col gap-12 focus-visible:ring-0 focus-visible:ring-offset-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
