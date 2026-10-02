"use client";

import { createClient } from "@/lib/supabase/client";
import { AuthError, AuthHeading } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "The password could not be saved. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <AuthHeading title="Set a new password">You will be signed in as soon as it is saved.</AuthHeading>
      <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <AuthError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
