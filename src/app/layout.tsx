import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { getSessionUser } from "@/lib/supabase/auth";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-sora",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Blackbird GM",
  description: "Stealth intelligence for fantasy football draft rooms."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const userInitial = user?.email?.[0]?.toUpperCase();

  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-x-0 top-[-14rem] h-[28rem] bg-[radial-gradient(circle_at_top,_rgba(26,110,252,0.14),_transparent_62%)]" />
          <div className="absolute right-[-12rem] top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(26,110,252,0.07),_transparent_68%)] blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(26,110,252,0.05),_transparent_72%)] blur-3xl" />
        </div>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-background/86 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4">
            <Link href="/" aria-label="Blackbird GM home" className="min-w-0">
              <BrandLockup />
            </Link>
            <NavLinks userInitial={userInitial} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
