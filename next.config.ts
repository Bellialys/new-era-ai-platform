import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// Development (Turbopack): 'unsafe-eval' is required for HMR module loading.
// Production: only 'unsafe-inline' is needed for Next.js hydration scripts.
//
// connect-src includes supabase.co for the client-side Supabase auth SDK.
// OpenRouter is intentionally absent -- it MUST only be called from backend
// route handlers, never from the client. See CLAUDE.md.
// ---------------------------------------------------------------------------
const isDev = process.env.NODE_ENV !== "production";

const cspParts = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://" + "*.supabase.co wss://" + "*.supabase.co",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
];
const csp = cspParts.join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },

  // Allow next/image to serve images from Supabase Storage (avatars, etc.)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection (legacy browsers)
          { key: "X-Frame-Options", value: "DENY" },
          // MIME-sniffing protection
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Content Security Policy
          { key: "Content-Security-Policy", value: csp },
          // HTTP Strict Transport Security -- 1 year, enforce on all subdomains
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Restrict browser features the app does not use
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "interest-cohort=()",
              "payment=()",
              "usb=()",
              "display-capture=()",
            ].join(", "),
          },
          // Cross-origin isolation
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // No Adobe/Macromedia cross-domain policy files
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default nextConfig;
