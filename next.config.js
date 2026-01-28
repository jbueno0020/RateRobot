/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Disable image optimization for simpler setup
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
