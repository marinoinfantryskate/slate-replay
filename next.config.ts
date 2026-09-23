import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The game pool is read from disk at runtime; make sure it ships with the server bundle.
  outputFileTracingIncludes: {
    "/*": ["./data/pool/*.json", "./drizzle/**/*"],
  },
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
