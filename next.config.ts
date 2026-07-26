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
        destination: "/portal/pne-guide",
        permanent: true,
      },
      {
        source: "/portal/nervous-system/:path*",
        destination: "/portal/pne-guide/:path*",
        permanent: true,
      },
      {
        source: "/portal/somatic-companion",
        destination: "/portal/pne-guide",
        permanent: true,
      },
      {
        source: "/portal/somatic-companion/:path*",
        destination: "/portal/pne-guide/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
