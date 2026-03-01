/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 0.A2: re-enabled now that tsc --noEmit is clean across the tree.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
