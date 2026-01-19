import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@aws-internal/auth",
    "@aws-internal/db",
    "@aws-internal/ui",
  ],
};

export default nextConfig;
