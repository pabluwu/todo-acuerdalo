import type { NextConfig } from 'next';

const backend = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    // el service worker nunca debe quedar en caché para que las actualizaciones lleguen
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
