import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/pwa/icon";
import { LogoMark } from "./logo";

/** Logo mark and app name, set wide like the wordmark in the logo. */
export function Brand({ href = "/dashboard", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-3 rounded-md", className)}>
      <LogoMark size={34} />
      <span className="font-display text-[15px] font-semibold uppercase leading-none tracking-[0.28em]">{BRAND.name}</span>
    </Link>
  );
}
