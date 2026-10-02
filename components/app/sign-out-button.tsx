"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // A full page load, not a client navigation: it drops every page held in the in-memory client cache.
    window.location.assign("/auth/login");
  };

  return (
    <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
      <LogOut className="text-muted-foreground" />
    </Button>
  );
}
