import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
    ],
  },
  // Production player profile reads should use PROFILE_STORAGE_MODE=remote.
  // Local profile artifacts are kept only for local build/upload/dev fallback.
  // Do not bundle player profile shards into Vercel functions.
};

export default nextConfig;
