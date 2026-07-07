/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ["@outreach-engine/types", "@outreach-engine/utils"],
  },
};

module.exports = nextConfig;
