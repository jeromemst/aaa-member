/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Stripe webhook needs raw body — no caching
        source: '/api/billing/webhook',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
