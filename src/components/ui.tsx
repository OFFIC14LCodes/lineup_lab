import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-8", className)}>{children}</main>;
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rf-panel p-5", className)}>{children}</section>;
}

export function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rf-panel p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("mt-2 text-2xl font-black", accent && "text-electric")}>{value}</div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rf-panel p-6 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </div>
  );
}
