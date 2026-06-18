import { cn } from "@/lib/utils";

export function BrandLockup({
  className,
  size = "sm",
  showTagline = false
}: {
  className?: string;
  size?: "sm" | "lg";
  showTagline?: boolean;
}) {
  const isLarge = size === "lg";

  return (
    <div className={cn("flex items-center gap-3", isLarge && "gap-4", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-line/80 bg-black/40 shadow-glow",
          isLarge ? "w-[160px]" : "w-[56px] sm:w-[72px]"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/Blackbird%20Icon.svg"
          alt="Blackbird GM"
          width={isLarge ? 160 : 72}
          height={isLarge ? 68 : 31}
          className="h-auto w-full object-contain"
        />
      </div>
      <div>
        <div className={cn("brand-display leading-none text-white", isLarge ? "text-5xl md:text-6xl" : "text-xl sm:text-2xl")}>
          Blackbird <span className="text-electric">GM</span>
        </div>
        {showTagline ? (
          <p className="mt-2 text-sm uppercase tracking-[0.28em] text-slate-400">
            Draft War Room Intelligence
          </p>
        ) : null}
      </div>
    </div>
  );
}
