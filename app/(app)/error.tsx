"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">This page did not load</h1>
      <p className="text-muted-foreground">Something went wrong while fetching your data. Nothing was changed. Check your connection, then load the page again.</p>
      <Button onClick={() => retry()}>Load again</Button>
    </div>
  );
}
