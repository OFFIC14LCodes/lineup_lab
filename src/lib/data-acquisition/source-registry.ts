import { existsSync } from "node:fs";
import path from "node:path";

import type { DataSourceDescriptor, DataSourceStatus } from "./data-source-types";

export function dataSourceRegistry(): DataSourceDescriptor[] {
  return [
    {
      sourceId: "local_rookie_draft_capital_csv",
      sourceName: "Local rookie draft capital CSV",
      sourceCategory: "nfl_draft_capital",
      acquisitionMethod: "local_csv",
      requiresApiKey: false,
      localPath: path.join(process.cwd(), "data", "rookies", "sources", "draft-capital.csv"),
      enabled: true,
      priority: 10,
      notes: ["Preferred offline source for verified NFL draft capital."],
    },
    {
      sourceId: "local_rookie_college_production_csv",
      sourceName: "Local rookie college production CSV",
      sourceCategory: "college_player_stats",
      acquisitionMethod: "local_csv",
      requiresApiKey: false,
      localPath: path.join(process.cwd(), "data", "rookies", "sources", "college-production.csv"),
      enabled: true,
      priority: 20,
      notes: ["Preferred offline source for verified college production profiles."],
    },
    {
      sourceId: "local_rookie_role_notes_csv",
      sourceName: "Local rookie role notes CSV",
      sourceCategory: "manual_role_notes",
      acquisitionMethod: "manual",
      requiresApiKey: false,
      localPath: path.join(process.cwd(), "data", "rookies", "sources", "role-notes.csv"),
      enabled: true,
      priority: 30,
      notes: ["Manual/imported opportunity notes. Missing values remain data gaps."],
    },
    {
      sourceId: "cfbd_api_college_stats",
      sourceName: "CollegeFootballData API",
      sourceCategory: "college_player_stats",
      acquisitionMethod: "api",
      requiresApiKey: true,
      apiKeyEnvName: "CFBD_API_KEY",
      enabled: Boolean(process.env.CFBD_API_KEY),
      priority: 60,
      notes: ["Disabled unless CFBD_API_KEY is configured. No API calls are made by diagnostics."],
    },
    {
      sourceId: "sportsdataio_context_api",
      sourceName: "SportsDataIO context API placeholder",
      sourceCategory: "provider_projection_context",
      acquisitionMethod: "api",
      requiresApiKey: true,
      apiKeyEnvName: "SPORTSDATAIO_API_KEY",
      enabled: Boolean(process.env.SPORTSDATAIO_API_KEY),
      priority: 80,
      notes: ["Placeholder only. Requires explicit source integration approval before use."],
    },
  ];
}

export function sourceStatuses(sources = dataSourceRegistry()): DataSourceStatus[] {
  return sources.map((source) => {
    const hasKey = source.apiKeyEnvName ? Boolean(process.env[source.apiKeyEnvName]) : true;
    const hasLocalFile = source.localPath ? existsSync(source.localPath) : true;
    const configured = source.requiresApiKey ? hasKey : hasLocalFile;
    const available = source.enabled && configured;
    const skippedReason = available
      ? null
      : source.requiresApiKey && !hasKey
        ? `missing ${source.apiKeyEnvName}`
        : source.localPath && !hasLocalFile
          ? "local file missing"
          : !source.enabled
            ? "source disabled"
            : "not configured";
    return { ...source, configured, available, skippedReason };
  });
}
