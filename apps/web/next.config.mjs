/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ['@shelterplus/shared']
};

export default nextConfig;
