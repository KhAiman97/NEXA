"use client";

import { createClient } from "@/lib/supabase/client";
import { AuthError, AuthHeading } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "The reset email could not be sent. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <AuthHeading title="Check your email">If an account exists for {email}, a link to set a new password is on its way.</AuthHeading>
        <Link href="/auth/login" className="rounded text-sm font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Reset your password">Enter your email and we will send a link to set a new password.</AuthHeading>
      <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <AuthError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/auth/login" className="rounded font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
