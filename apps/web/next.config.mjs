/** @type {import('next').NextConfig} */
import path from 'node:path';

const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ['@shelterplus/shared'],
  webpack: (config) => {
    config.resolve.alias['@shelterplus/shared'] = path.resolve(
      process.cwd(),
      '..',
      '..',
      'packages/shared/src'
    );
    return config;
  }
};

export default nextConfig;
