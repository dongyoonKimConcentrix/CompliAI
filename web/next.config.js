/** @type {import('next').NextConfig} */
const apiOrigin = process.env.FASTAPI_INTERNAL_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: `${apiOrigin}/uploads/:path*` }];
  },
};

module.exports = nextConfig;
