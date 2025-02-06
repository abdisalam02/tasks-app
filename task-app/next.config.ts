import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // This setting allows production builds to succeed even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  // ...other config options
};

export default nextConfig;
