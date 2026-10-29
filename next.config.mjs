/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['twilio'],
    serverActions: { bodySizeLimit: '8mb' }, // People imports send a few thousand rows
  },
};
export default nextConfig;
