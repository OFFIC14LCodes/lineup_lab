import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/*": [
      "./artifacts/**/*",
      "./data/**/*",
    ],
  },
  outputFileTracingIncludes: {
    "/api/player-profiles/[playerId]": [
      "./artifacts/projections/player-profiles.json",
    ],
  },
};

export default nextConfig;
