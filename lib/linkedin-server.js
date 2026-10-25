/* LinkedIn sharing, server side only (app/api/linkedin/*).

   One personal LinkedIn profile is connected (public.linkedin_account).
   A blog post whose live version says linkedin.share is posted to it once,
   as a link card to digitorium.in/blog/<slug>/, when the post is live.
   This file holds the service role key and the LinkedIn token, so it must
   never be imported by a screen.

   Environment (Vercel → Settings → Environment Variables):
     LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   from the LinkedIn developer app
     SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
     CRON_SECRET                                  Vercel sends it to the daily share run
     LINKEDIN_VERSION                             optional, the API version (YYYYMM) */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SITE_URL } from "./supabase";

const API = "https://api.linkedin.com";
const VERSION = process.env.LINKEDIN_VERSION || "202609";
/* openid + profile tell us who connected; w_member_social lets us post as them */
const SCOPES = "openid profile w_member_social";
/* a share that started longer ago than this is taken to have died */
const CLAIM_MINUTES = 10;

let adminClient;
export function admin() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set on the server.");
  if (!adminClient) adminClient = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

export function configured() {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

/* The signed-in Studio member behind a request's "Authorization: Bearer
   <Supabase access token>", as { email, role }, or null. Same rule as
   public.studio_role(): a confirmed email listed in studio_members. */
export async function memberFrom(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;
  const email = data.user.email.toLowerCase();
  const { data: m } = await db.from("studio_members").select("role").eq("email", email).maybeSingle();
  return m ? { email, role: m.role } : null;
}

export async function log(actor, action, target) {
  try {
    await admin().from("studio_activity").insert({ actor, action, target: target ? String(target).slice(0, 300) : null });
  } catch (e) {
    /* logging is best effort */
  }
}

/* ---------------------------------------------------------------- connecting */

/* The OAuth "state": who asked and where to come back, signed so the
   callback can trust it. Valid for 15 minutes. */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", process.env.LINKEDIN_CLIENT_SECRET).update(body).digest("base64url");
  return body + "." + mac;
}

export function readState(state) {
  const [body, mac] = String(state || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", process.env.LINKEDIN_CLIENT_SECRET).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}

export function callbackUrl(origin) {
  return origin + "/api/linkedin/callback";
}

export function authorizeUrl(origin, email) {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: callbackUrl(origin),
    scope: SCOPES,
    state: sign({ email, exp: Date.now() + 15 * 60 * 1000 }),
  });
  return "https://www.linkedin.com/oauth/v2/authorization?" + q;
}

/* Swaps the code LinkedIn sent back for a token, finds out whose profile it
   is, and stores it. A new connection retries posts that failed before. */
export async function connect(origin, code, email) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(origin),
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) throw new Error(tok.error_description || "LinkedIn did not give a token.");

  const me = await fetch(API + "/v2/userinfo", { headers: { Authorization: "Bearer " + tok.access_token } }).then((r) => r.json());
  if (!me.sub) throw new Error("LinkedIn did not say whose profile this is.");

  const db = admin();
  const { error } = await db.from("linkedin_account").upsert({
    id: 1,
    person_urn: "urn:li:person:" + me.sub,
    name: me.name || [me.given_name, me.family_name].filter(Boolean).join(" ") || null,
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + (tok.expires_in || 5184000) * 1000).toISOString(),
    connected_by: email,
    connected_at: new Date().toISOString(),
  });
  if (error) throw error;
  await db.from("posts").update({ linkedin_error: null }).is("linkedin_urn", null).not("linkedin_error", "is", null);
  return me.name;
}

export async function disconnect() {
  const { error } = await admin().from("linkedin_account").delete().eq("id", 1);
  if (error) throw error;
}

/* ---------------------------------------------------------------- sharing */

/* Shares every live post that asks for it and has not been shared yet.
   Safe to call often and from several places at once: each post is
   claimed first, and a shared post is never shared again. */
export async function shareDue() {
  const db = admin();
  const { data: account } = await db.from("linkedin_account").select("*").eq("id", 1).maybeSingle();
  if (!account) return { shared: 0, waiting: "not connected" };
  if (new Date(account.expires_at) <= new Date()) return { shared: 0, waiting: "connection expired" };

  const now = new Date().toISOString();
  const { data: due, error } = await db
    .from("posts")
    .select("id, slug, published")
    .not("published", "is", null)
    .lte("publish_at", now)
    .is("linkedin_urn", null)
    .is("linkedin_error", null)
    .eq("published->linkedin->>share", "true")
    .order("publish_at")
    .limit(5);
  if (error) throw error;

  let shared = 0;
  const stale = new Date(Date.now() - CLAIM_MINUTES * 60 * 1000).toISOString();
  for (const post of due) {
    const { data: claimed } = await db
      .from("posts")
      .update({ linkedin_claimed_at: new Date().toISOString() })
      .eq("id", post.id)
      .is("linkedin_urn", null)
      .or("linkedin_claimed_at.is.null,linkedin_claimed_at.lt." + stale)
      .select("id");
    if (!claimed?.length) continue;
    try {
      const urn = await sharePost(account, post);
      await db.from("posts").update({ linkedin_urn: urn, linkedin_shared_at: new Date().toISOString(), linkedin_claimed_at: null }).eq("id", post.id);
      await log(account.connected_by || "studio", "post.linkedin", post.published.title);
      shared++;
    } catch (e) {
      await db.from("posts").update({ linkedin_error: String(e.message || e).slice(0, 500), linkedin_claimed_at: null }).eq("id", post.id);
    }
  }
  return { shared };
}

/* Lets a failed post be tried again by the next shareDue(). */
export async function clearError(id) {
  await admin().from("posts").update({ linkedin_error: null }).eq("id", id).is("linkedin_urn", null);
}

async function sharePost(account, post) {
  const p = post.published;
  const link = SITE_URL + "/blog/" + post.slug;
  const text = (p.linkedin?.text || "").trim() || [p.title, p.excerpt].filter(Boolean).join("\n\n");

  const article = { source: link, title: p.title.slice(0, 400) };
  if (p.excerpt) article.description = p.excerpt.slice(0, 4000);
  const thumb = p.cover ? await uploadImage(account, new URL(p.cover, SITE_URL).href).catch(() => null) : null;
  if (thumb) article.thumbnail = thumb;

  const res = await linkedin(account, "/rest/posts", {
    author: account.person_urn,
    commentary: littleText(text).slice(0, 3000),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { article },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
  const urn = res.headers.get("x-restli-id");
  if (!urn) throw new Error("LinkedIn accepted the post but did not return its id.");
  return urn;
}

/* LinkedIn only takes JPG, PNG or GIF, and the site's pictures are mostly
   WebP, so other formats are turned into a JPG first. Returns the image URN. */
async function uploadImage(account, url) {
  const pic = await fetch(url);
  if (!pic.ok) throw new Error("cover not found");
  let bytes = Buffer.from(await pic.arrayBuffer());
  if (!/^image\/(jpeg|png|gif)$/.test(pic.headers.get("content-type") || "")) {
    const sharp = (await import("sharp")).default;
    bytes = await sharp(bytes).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  }
  const init = await linkedin(account, "/rest/images?action=initializeUpload", { initializeUploadRequest: { owner: account.person_urn } });
  const { value } = await init.json();
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: "Bearer " + account.access_token }, body: bytes });
  if (!put.ok) throw new Error("image upload failed");
  return value.image;
}

async function linkedin(account, path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + account.access_token,
      "Content-Type": "application/json",
      "LinkedIn-Version": VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return res;
  if (res.status === 401) throw new Error("The LinkedIn connection has expired. Reconnect it under Account, then try again.");
  const err = await res.json().catch(() => ({}));
  throw new Error("LinkedIn said: " + (err.message || res.status + " " + res.statusText));
}

/* Post text is LinkedIn "little text": these characters must be escaped,
   or LinkedIn cuts the post short at the first one. #words stay hashtags. */
function littleText(s) {
  return s
    .replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c)
    .replace(/\\#(\w+)/g, "{hashtag|\\#|$1}");
}
