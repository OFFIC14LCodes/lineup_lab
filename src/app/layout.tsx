import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "RosterForge",
  description: "Sleeper-first live fantasy football draft assistant."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-100 antialiased">
        <header className="border-b border-line/80 bg-background/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-black tracking-wide">
              RosterForge
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/leagues">Leagues</Link>
              <Link href="/rankings">Rankings</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
