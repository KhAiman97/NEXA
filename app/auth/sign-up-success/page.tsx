import Link from "next/link";
import { AuthHeading } from "@/components/auth-form";

export const metadata = { title: "Confirm your email" };

export default function Page() {
  return (
    <div>
      <AuthHeading title="Confirm your email">Your account is created. Open the link we emailed you to confirm the address, then sign in.</AuthHeading>
      <Link href="/auth/login" className="rounded text-sm font-medium underline underline-offset-4">
        Go to sign in
      </Link>
    </div>
  );
}
