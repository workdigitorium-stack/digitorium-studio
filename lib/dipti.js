/* Dipti Enterprise (diptienterprise.com): reads and writes the de_* tables.
   Row level security lets Digitorium staff editors and Dipti's own logins
   (client_members) change them; visitors only read active rows.

   The site re-reads these tables every 5 minutes. After a save we also ask
   it to refresh straight away (refreshSite), so changes show in seconds. */
import { supabase, SUPABASE_URL, logActivity } from "./supabase";
import { CLIENTS } from "./clients";

export const CLIENT = "dipti-enterprise";
export const SITE = CLIENTS[CLIENT].site;
const BUCKET = "client-media";

export function db() {
  return supabase();
}

export function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function price(p) {
  return p == null ? "Price on request" : "₹" + inr.format(p);
}

/* Images in the site's own /public folder are served from the site. */
export function imgUrl(src) {
  if (!src) return "";
  return /^https?:/.test(src) ? src : SITE + src;
}

/* Shrink to at most 1600px, save as WebP, and return { src, width, height }. */
export async function uploadImage(file, section) {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is over 15 MB. Make it smaller first.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
  const body = blob || file;
  const ext = blob ? ".webp" : "." + file.type.split("/")[1];
  const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "photo";
  const path = CLIENT + "/" + section + "/" + Date.now().toString(36) + "-" + base + ext;
  const { error } = await db().storage.from(BUCKET).upload(path, body, { contentType: blob ? "image/webp" : file.type, upsert: false });
  if (error) throw error;
  logActivity("dipti.upload", path, { size: body.size });
  return { src: SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + path, width, height };
}

/* Ask diptienterprise.com to drop its cached copy now. Best effort: if it
   fails the site still picks the change up within 5 minutes. */
export async function refreshSite() {
  try {
    const { data } = await db().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch(SITE + "/api/revalidate", { method: "POST", headers: { Authorization: "Bearer " + token } });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Save, log and refresh the site in one go. Returns { error }. */
export async function saved(result, action, target, toast) {
  if (result.error) {
    toast(friendly(result.error.message), { bad: true });
    return result;
  }
  logActivity(action, target);
  const live = await refreshSite();
  toast(live ? "Saved. It is live on the website now." : "Saved. It will show on the website within 5 minutes.");
  return result;
}

export function friendly(msg) {
  if (/row-level security|permission denied/i.test(msg)) return "You do not have permission to change this.";
  if (/duplicate key.*slug/i.test(msg)) return "Another product already uses that web address. Change the address.";
  if (/de_products_category_fkey|foreign key/i.test(msg)) return "That category is still used by products. Move them first.";
  if (/check constraint.*slug/i.test(msg)) return "The web address can only use small letters, numbers and dashes.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "No internet connection. Try again.";
  return msg;
}

/* Swap the order of two rows (sort column), keyed by keyCol. */
export async function swapSort(table, a, b, keyCol = "id") {
  const r1 = await db().from(table).update({ sort: b.sort }).eq(keyCol, a[keyCol]);
  if (r1.error) return r1;
  return db().from(table).update({ sort: a.sort }).eq(keyCol, b[keyCol]);
}
