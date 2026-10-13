/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function uploadPattern(url) {
  try {
    const u = new URL(url);
    const pattern = {
      protocol: u.protocol.replace(":", ""),
      hostname: u.hostname,
      pathname: "/uploads/**",
    };
    if (u.port) pattern.port = u.port;
    return pattern;
  } catch {
    return null;
  }
}

const remotePatterns = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "5000",
    pathname: "/uploads/**",
  },
  uploadPattern(BACKEND_URL),
  uploadPattern(API_BASE_URL),
]
  .filter(Boolean)
  .filter(
    (p, i, arr) =>
      arr.findIndex(
        (q) =>
          q.protocol === p.protocol &&
          q.hostname === p.hostname &&
          (q.port || "") === (p.port || "")
      ) === i
  );

const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    dangerouslyAllowLocalIP: true,
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Powered-By", value: "" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
