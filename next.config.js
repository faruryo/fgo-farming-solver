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
    // onnxruntime-web の既定ビルドは WebGPU(JSEP) 用の wasm (26.8MB) を静的アセットとして
    // 含んでしまい、Cloudflare Workers のアセットサイズ上限(25MiB)を超える。
    // 本機能はCOEP非導入のシングルスレッドWASM運用が前提（design.md Decision 5）で
    // WebGPU/JSEPは不要なため、wasm専用ビルド（13.5MB）にエイリアスする。
    config.resolve.alias['onnxruntime-web'] = require.resolve('onnxruntime-web/wasm')
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
    resolveAlias: {
      'onnxruntime-web': 'onnxruntime-web/wasm',
    },
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
