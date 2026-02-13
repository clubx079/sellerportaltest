/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-project.supabase.co'],
  },
  // Optimize for faster page transitions
  reactStrictMode: true,
  swcMinify: true,
}

export default nextConfig
