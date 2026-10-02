import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Nexa mark, cut from logo.png. It is white on black, so it sits on its own black tile. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.png" alt="" width={size} height={size} priority className={cn("rounded-[28%] bg-black", className)} />;
}

/**
 * Loading animation. The mark is drawn with no background (logo.png's brightness is used as a mask),
 * so it takes the page's text colour: a band of light sweeps through it in the section's colour, an
 * arc orbits it, rings ripple out from behind and the mark floats. With reduced motion it is shown solid and still.
 */
export function LogoLoader({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("flex flex-col items-center justify-center gap-6 py-24", className)}>
      <div className="logo-loader" aria-hidden>
        <span className="logo-orbit" />
        <span className="logo-ripple" />
        <span className="logo-ripple logo-ripple-late" />
        <span className="logo-mask" />
      </div>
      <span className="eyebrow logo-loader-label text-muted-foreground">{label}</span>
    </div>
  );
}
