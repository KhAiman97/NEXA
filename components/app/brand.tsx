import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/pwa/icon";
import { LogoMark } from "./logo";

/** Logo mark and the NEXA wordmark, both cut from logo.png. */
export function Brand({ href = "/dashboard", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-3 rounded-md", className)}>
      <LogoMark size={34} />
      <span aria-hidden className="wordmark" />
      <span className="sr-only">{BRAND.name}</span>
    </Link>
  );
}
