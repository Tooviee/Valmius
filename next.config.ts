import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Static CSP without nonces, so pages can stay statically rendered (SPEC.md section 11).
// The App Router inlines its bootstrap scripts, which is why script-src needs 'unsafe-inline'.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Development only: lets a phone on the same Wi-Fi open the dev server (for example
  // http://jeonghuns-laptop.local:3000 or the Mac's 10.x / 192.168.x address) with its
  // scripts and hot reload working. Production never uses this.
  allowedDevOrigins: ["*.local", "10.*.*.*", "192.168.*.*", "172.*.*.*", "100.*.*.*"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
