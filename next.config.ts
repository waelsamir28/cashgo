import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PostgreSQL pool requires the standard Node.js server runtime on Vercel.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
