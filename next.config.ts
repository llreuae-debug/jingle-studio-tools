import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@contentauth/c2pa-node", "@electric-sql/pglite"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
