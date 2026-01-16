import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aws-internal/auth",
    "@aws-internal/db",
    "@aws-internal/ui",
  ],
};

export default nextConfig;
