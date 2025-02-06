import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This setting allows production builds to succeed even if there are ESLint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // This setting disables type checking during production builds.
  typescript: {
    ignoreBuildErrors: true,
  },
  // You can add any additional Next.js config options here.
};

export default nextConfig;
