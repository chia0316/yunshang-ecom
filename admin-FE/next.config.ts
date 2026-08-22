import type { NextConfig } from "next";

// Only set in the production Docker build (see Dockerfile/docker-compose.yml)
// — nginx proxies https://<domain>/admin/* straight through to this app
// without stripping the prefix, so the app itself needs to know it's not
// living at the root. Left unset for local dev, which still runs at
// http://localhost:3000/ as before.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone folder with only the files needed to
  // run the app, so the Docker image doesn't need the full node_modules tree.
  output: "standalone",
  basePath,
};

export default nextConfig;
