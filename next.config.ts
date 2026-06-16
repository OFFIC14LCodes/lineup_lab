import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/*": [
      "./artifacts/**/*",
      "./data/**/*",
    ],
  },
};

export default nextConfig;
