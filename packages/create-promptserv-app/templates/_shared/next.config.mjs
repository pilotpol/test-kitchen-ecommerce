/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone: a server plus only the node_modules it actually
  // needs. The Dockerfile copies exactly that, which is what keeps the runtime
  // image free of the toolchain and the dev dependencies.
  output: "standalone",
  transpilePackages: [
    "@repo/ai-gateway-sdk",
    "@repo/auth-bff",
    "@repo/auth-core",
  ],
};

export default nextConfig;
