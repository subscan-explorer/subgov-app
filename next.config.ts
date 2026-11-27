import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Optional local preview hosts; never include credentials or URL paths.
  allowedDevOrigins: process.env.SUBGOV_DEV_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
