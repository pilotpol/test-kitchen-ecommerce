import type { NextConfig } from "next";

/*
 * standalone: the deployed application is a container, and the container is
 * built from this monorepo by one shared Dockerfile. Standalone output is what
 * lets that image carry the app and the slice of node_modules it actually uses
 * instead of the whole workspace.
 */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
