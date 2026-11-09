/** @type {import('next').NextConfig} */
const nextConfig = {
  // Servidor autonomo (node server.js) para correr na VM Oracle, sem node_modules inteiro
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  // Manual de utilizacao: pagina estatica em public/manual, servida em /manual
  async rewrites() {
    return [{ source: "/manual", destination: "/manual/index.html" }]
  },
  // O sistema mudou-se para a VM Oracle: no Vercel (sem base de dados) so
  // reencaminha para o endereco novo, mantendo o caminho (links do PIN, portal...)
  async redirects() {
    if (process.env.VERCEL !== "1") return []
    return [{ source: "/:caminho*", destination: "https://erp.tecknowhow.pt/:caminho*", permanent: false }]
  },
  // Otimizações para evitar timeout de chunks
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20
            },
            // Commons chunk
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true
            }
          }
        }
      }
    }
    return config
  }
}

export default nextConfig
