import type { NextConfig } from 'next';

const backend = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  // subidas de video de hasta 500 MB por el proxy /api (en producción nginx las manda directo al backend;
  // esto cubre desarrollo y docker local): Next corta los cuerpos en 10 MB por defecto
  experimental: { proxyTimeout: 15 * 60 * 1000, middlewareClientMaxBodySize: '510mb' },
  async headers() {
    // el service worker nunca debe quedar en caché para que las actualizaciones lleguen
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
