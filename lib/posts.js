/* Blog posts (public.posts): what Studio → Posts reads and writes.

   Each post has a draft, autosaved as you type, and a published version
   the site shows at digitorium.in/blog/<slug>/ from publish_at on. Owners
   and admins publish now or at a date (publish_post), unpublish, restore an
   earlier version or delete; editors write drafts. The draft:
     { title, slug, excerpt, cover, cover_alt, category, tags: [],
       body: <Tiptap JSON>, seo_title, seo_description, noindex } */
import { supabase } from "./supabase";
import { refreshSite } from "./content";

export const BLANK = {
  title: "",
  slug: "",
  excerpt: "",
  cover: "",
  cover_alt: "",
  category: "",
  tags: [],
  body: { type: "doc", content: [{ type: "paragraph" }] },
  seo_title: "",
  seo_description: "",
  noindex: false,
};

export const CATEGORIES = ["Websites", "Custom software", "Ads", "SEO", "Shoots", "Branding", "Case notes", "News"];

/* "Why Most Ads Fail?" → "why-most-ads-fail" */
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const SLUG_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* Draft / Scheduled / Live / Live, with unpublished changes */
export function postStatus(p) {
  if (!p.published) return { key: "draft", label: "Draft" };
  if (new Date(p.publish_at) > new Date()) return { key: "scheduled", label: "Scheduled" };
  const same = JSON.stringify(sorted(p.draft)) === JSON.stringify(sorted(p.published));
  return same ? { key: "live", label: "Live" } : { key: "changed", label: "Live, unpublished changes" };
}
function sorted(x) {
  return Array.isArray(x) ? x.map(sorted) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted(x[k])])) : x;
}

export async function fetchPosts() {
  const { data, error } = await supabase()
    .from("posts")
    .select("id, slug, draft, published, publish_at, published_at, draft_updated_at, draft_updated_by, created_at")
    .order("draft_updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchPost(id) {
  const { data, error } = await supabase().from("posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPost() {
  const { data, error } = await supabase().from("posts").insert({ draft: BLANK }).select("id").single();
  if (error) throw error;
  return data.id;
}

/* Saves only if nobody else saved since `since`; null if someone did. */
export async function savePostDraft(id, draft, since) {
  const { data, error } = await supabase()
    .from("posts")
    .update({ draft })
    .eq("id", id)
    .eq("draft_updated_at", since)
    .select("draft_updated_at, draft_updated_by")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* at: null for now, or a Date for later. Returns whether the site refreshed. */
export async function publishPost(id, at) {
  const { error } = await supabase().rpc("publish_post", { p_id: id, p_at: at ? at.toISOString() : null });
  if (error) throw error;
  return refreshSite();
}

export async function unpublishPost(id) {
  const { error } = await supabase().rpc("unpublish_post", { p_id: id });
  if (error) throw error;
  return refreshSite();
}

export async function deletePost(id) {
  const { error } = await supabase().from("posts").delete().eq("id", id);
  if (error) throw error;
  return refreshSite();
}

export async function fetchPostVersions(id) {
  const { data, error } = await supabase()
    .from("post_versions")
    .select("id, published_at, published_by, note")
    .eq("post_id", id)
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function restorePostVersion(versionId) {
  const { error } = await supabase().rpc("restore_post_version", { p_version: versionId });
  if (error) throw error;
  return refreshSite();
}
