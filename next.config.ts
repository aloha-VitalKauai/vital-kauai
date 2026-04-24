import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "herbalistics.com.au",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/portal/nervous-system",
        destination: "/portal/somatic-companion",
        permanent: true,
      },
      {
        source: "/portal/nervous-system/:path*",
        destination: "/portal/somatic-companion/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
