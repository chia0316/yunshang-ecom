import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone folder with only the files needed to
  // run the app, so the Docker image doesn't need the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
