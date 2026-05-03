/**
 * @type {import('next').NextConfig}
 */

const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
initOpenNextCloudflareForDev();

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
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
      'LICENSE': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
}

module.exports = nextConfig
