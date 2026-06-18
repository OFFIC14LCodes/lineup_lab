"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leagues", label: "Leagues" },
  { href: "/rankings", label: "Rankings" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavLinks({ userInitial }: { userInitial?: string }) {
  const pathname = usePathname();

  return (
    <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 text-sm text-slate-300">
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "rf-nav-link",
                isActive && "border border-electric/20 bg-electric/10 text-electric"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {userInitial && (
        <div className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-electric/30 bg-electric/10 text-xs font-black uppercase text-electric">
          {userInitial}
        </div>
      )}
    </div>
  );
}
