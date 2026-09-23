import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The game pool is read from disk at runtime; make sure it ships with the server bundle.
  outputFileTracingIncludes: {
    "/*": ["./data/pool/*.json", "./drizzle/**/*"],
  },
  serverExternalPackages: ["@electric-sql/pglite"],
  // A stray package-lock.json in the home folder otherwise confuses root detection.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
