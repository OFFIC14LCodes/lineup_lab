import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
    ],
  },
  outputFileTracingIncludes: {
    // Local sharded profile artifacts remain packaged as the safe fallback.
    // Remote Supabase Storage is optional and selected only by PROFILE_STORAGE_MODE=remote.
    "/api/player-profiles/[playerId]": [
      "./artifacts/projections/player-profiles-sharded/**/*",
    ],
  },
};

export default nextConfig;
