import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Enable standalone output for Docker builds
    output: 'standalone',
    // Mark Node.js-only packages as external so they don't get bundled
    serverExternalPackages: [
        '@mapbox/node-pre-gyp',
    ],
    // Silence Turbopack warning about custom webpack config if needed, 
    // though we are removing webpack config now.
    turbopack: {},
};

export default nextConfig;
