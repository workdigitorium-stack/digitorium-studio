/* Small display helpers shared by the screens. Times show in India time. */

const TZ = "Asia/Kolkata";

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return d + " days ago";
  return dateTime(iso, false);
}

export function dateTime(iso, withTime = true) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/* Start of today in India, as an ISO string, for "today" counts. */
export function startOfTodayIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const offset = now.getTime() - ist.getTime();
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() + offset).toISOString();
}

/* wa.me wants digits only, with the country code. Ten-digit numbers are Indian. */
export function whatsappLink(phone, text) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
}

export function bytes(n) {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

/* "home-reels" -> "Home reels", "bridal_glam" -> "Bridal glam" */
export function humanize(slug) {
  const s = String(slug || "").replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* A safe storage name: lowercase letters, digits and dashes. */
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(c.get(r))).join(","))].join("\r\n");
}

export function download(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
