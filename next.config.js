/* Content-Security-Policy for the Studio: everything it talks to is
   Supabase (data, auth, storage, realtime) and the website (preview,
   revalidate). Next's bootstrap is inline, hence 'unsafe-inline'. Sent as
   Report-Only until it has been checked against real use, then rename the
   header to Content-Security-Policy. */
const SUPABASE = "https://piqzapryetvfwonreova.supabase.co wss://piqzapryetvfwonreova.supabase.co";
const SITES = "https://www.digitorium.in https://digitorium.in https://diptienterprise.com https://www.diptienterprise.com";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: https:`,
  `media-src 'self' blob: ${SUPABASE}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${SUPABASE} ${SITES}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${SITES}`,
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  /* the Studio is private: keep every screen out of search engines */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
