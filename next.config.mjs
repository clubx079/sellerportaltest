/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-project.supabase.co'],
  },
  reactStrictMode: true,
  swcMinify: true,
  // Email templates (buyer + seller) expect logo at /deelmap.png – serve from existing asset
  async rewrites() {
    return [{ source: '/deelmap.png', destination: '/assets/logo%20copy.png' }]
  },
}

export default nextConfig
