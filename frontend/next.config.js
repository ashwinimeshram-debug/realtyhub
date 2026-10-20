/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

if (
  process.env.NODE_ENV === "production" &&
  /localhost|127\.0\.0\.1/.test(BACKEND_URL)
) {
  // Fail loudly at build time rather than silently serving a broken API origin.
  console.warn(
    "[next.config] NEXT_PUBLIC_BACKEND_URL is unset or points at localhost in a production build."
  );
}

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
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
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
