import { PageShell, Panel } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { SyncPlayersButton } from "@/components/sync-players-button";
import { isAdpBoardEnabled } from "@/lib/adp/server/access";
import { isProviderDataImportEnabled } from "@/lib/providers/import/access";
import { isScoringInspectorEnabled } from "@/lib/scoring/server";
import { isPlayerContextEnabled } from "@/lib/context/server/access";
import { requireUser } from "@/lib/supabase/auth";
import Link from "next/link";

export default async function SettingsPage() {
  await requireUser();
  const adpBoardEnabled = isAdpBoardEnabled();
  const providerImportEnabled = isProviderDataImportEnabled();
  const scoringInspectorEnabled = isScoringInspectorEnabled();
  const playerContextEnabled = isPlayerContextEnabled();

  return (
    <PageShell className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Panel>
        <h1 className="text-3xl font-black">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Account tools and player sync. Projection APIs and AI scoring come in later phases.
        </p>
        <div className="mt-6 space-y-4">
          <SyncPlayersButton />
          <Link href="/rankings" className="rf-button">
            Open rankings manager
          </Link>
          {providerImportEnabled ? (
            <Link href="/settings/data-import" className="rf-button">
              Open provider data import
            </Link>
          ) : null}
          {scoringInspectorEnabled ? (
            <Link href="/settings/scoring-inspector" className="rf-button secondary">
              Open scoring inspector
            </Link>
          ) : null}
          {adpBoardEnabled ? (
            <Link href="/settings/adp-board" className="rf-button secondary">
              Open ADP board
            </Link>
          ) : null}
          {playerContextEnabled ? (
            <Link href="/settings/player-context" className="rf-button secondary">
              Open player context
            </Link>
          ) : null}
        </div>
      </Panel>
      <Panel>
        <h2 className="text-xl font-bold">Account</h2>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Panel>
    </PageShell>
  );
}
