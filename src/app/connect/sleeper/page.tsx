import Link from "next/link";

import { PageShell, Panel } from "@/components/ui";
import { SleeperConnectForm } from "@/components/sleeper-connect-form";
import { requireUser } from "@/lib/supabase/auth";

export default async function ConnectSleeperPage() {
  await requireUser();

  return (
    <PageShell className="max-w-2xl">
      <Panel>
        <h1 className="text-3xl font-black">Connect Sleeper</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your Sleeper username to fetch your current NFL season leagues.
        </p>
        <div className="mt-6">
          <SleeperConnectForm />
        </div>
        <Link className="mt-6 inline-block text-sm text-brand" href="/leagues">
          View imported leagues
        </Link>
      </Panel>
    </PageShell>
  );
}
