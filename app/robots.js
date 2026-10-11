/* The Studio is private: tell every crawler to stay out. */
export default function robots() {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
