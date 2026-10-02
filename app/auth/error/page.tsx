import { Suspense } from "react";
import Link from "next/link";
import { AuthHeading } from "@/components/auth-form";

export const metadata = { title: "Sign-in problem" };

async function ErrorContent({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  const params = await searchParams;
  return (
    <p className="rounded-lg border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
      {params?.error ? params.error : "No further detail was given."}
    </p>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  return (
    <div>
      <AuthHeading title="That link did not work">It may have expired or already been used. Request a new one, or sign in with your password.</AuthHeading>
      <Suspense>
        <ErrorContent searchParams={searchParams} />
      </Suspense>
      <Link href="/auth/login" className="mt-6 inline-block rounded text-sm font-medium underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  );
}
