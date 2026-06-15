import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'proxnet.in',
          },
        ],
        destination: 'https://www.proxnet.in/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
