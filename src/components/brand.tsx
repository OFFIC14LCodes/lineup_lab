import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLockup({
  className,
  priority = false,
  size = "sm",
  showTagline = false
}: {
  className?: string;
  priority?: boolean;
  size?: "sm" | "lg";
  showTagline?: boolean;
}) {
  const isLarge = size === "lg";

  return (
    <div className={cn("flex items-center gap-3", isLarge && "gap-4", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-line/80 bg-black/60 shadow-glow",
          isLarge ? "w-[160px]" : "w-[72px]"
        )}
      >
        <Image
          src="/logos/Blackbird Logo.png"
          alt="Blackbird GM logo"
          width={1536}
          height={1024}
          priority={priority}
          className="h-auto w-full object-cover"
        />
      </div>
      <div>
        <div className={cn("brand-display leading-none text-white", isLarge ? "text-5xl md:text-6xl" : "text-2xl")}>
          Blackbird <span className="text-gold">GM</span>
        </div>
        {showTagline ? (
          <p className="mt-2 text-sm uppercase tracking-[0.28em] text-gold/80">
            Stealth intelligence for fantasy football
          </p>
        ) : null}
      </div>
    </div>
  );
}
