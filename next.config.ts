import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: "/catalog", destination: "/inventario", permanent: true },
    ];
  },
};

export default nextConfig;
