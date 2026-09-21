import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  // typedRoutes is intentionally off during active development: most nav
  // links below point at routes added in later phases. Re-enable in the
  // Phase 6 hardening pass once every route exists.
};

export default nextConfig;
