import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/brand";

import "./globals.css";

export const metadata: Metadata = {
  title: "Blackbird GM",
  description: "Stealth intelligence for fantasy football draft rooms."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-x-0 top-[-14rem] h-[28rem] bg-[radial-gradient(circle_at_top,_rgba(201,164,92,0.22),_transparent_62%)]" />
          <div className="absolute right-[-12rem] top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(185,25,25,0.16),_transparent_68%)] blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(255,230,162,0.1),_transparent_72%)] blur-3xl" />
        </div>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-background/86 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4">
            <Link href="/" aria-label="Blackbird GM home" className="min-w-0">
              <BrandLockup />
            </Link>
            <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 text-sm text-slate-300">
              <Link href="/dashboard" className="rf-nav-link">
                Dashboard
              </Link>
              <Link href="/leagues" className="rf-nav-link">
                Leagues
              </Link>
              <Link href="/rankings" className="rf-nav-link">
                Rankings
              </Link>
              <Link href="/settings" className="rf-nav-link">
                Settings
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
