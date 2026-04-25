/**
 * @type {import('next').NextConfig}
 */

const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.atlasacademy.io',
      },
      {
        protocol: 'https',
        hostname: 'assets.gamepress.gg',
      },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$|LICENSE$/,
      type: 'asset/source',
    })
    return config
  },
  async redirects() {

    return [
      {
        source: '/result',
        destination: '/farming/result',
        permanent: true,
      },
      {
        source: '/results/:id',
        destination: '/farming/results/:id',
        permanent: true,
      },
      {
        source: '/import-export',
        destination: '/farming/import-export',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
