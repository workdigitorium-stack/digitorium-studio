/* Editable site content: what the Pages and Brand screens edit.

   Each document ("brand", "home") is one row of public.site_content with a
   draft (edited here, autosaved) and a published version (what
   digitorium.in shows). The website repo reads it in app/content/content.js
   and keeps the same text in app/content/defaults.json as a fallback.

   DOCS below describes each document as a form. Field types:
     text, textarea   one line / a paragraph
     link             "/page/", "https://…", "tel:…" or "mailto:…"
     image            a URL, with an upload button (files go to media/site/)
     lines            a list of short strings, one per line
     toggle           yes / no
     select           one of `options`
     list             repeated items made of `fields`; `fixed` lists keep
                      their items and order (each is tied to artwork in the
                      site's code), other lists can add, remove and reorder */
import { supabase, SUPABASE_URL, SITE_URL } from "./supabase";
import PAGE_INDEX from "./site-pages/index.json";
import SEO_PAGES from "./site-pages/seo.json";

const ICONS = [
  ["web", "Browser (web design)"],
  ["software", "Code (software)"],
  ["ads", "Megaphone (ads)"],
  ["seo", "Magnifier (SEO)"],
  ["shoots", "Camera (shoots)"],
  ["branding", "Star (branding)"],
];

const SECTION_HEAD = [
  { key: "eyebrow", label: "Small label above the heading", type: "text", max: 60 },
  { key: "heading", label: "Heading", type: "text", max: 120 },
];

export const DOCS = {
  home: {
    key: "home",
    title: "Home",
    path: "/",
    edit: "content.edit",
    blurb: "The words on digitorium.in's home page. The reels and the hero video wall come from Media.",
    sections: [
      {
        key: "hero",
        title: "Hero",
        hint: "The headline at the top. Its last word rotates through the list below.",
        fields: [
          { key: "headline", label: "Headline", type: "text", max: 120 },
          { key: "words", label: "Rotating last word", type: "lines", hint: "One per line. They take turns at the end of the headline." },
          { key: "lede", label: "Line under the headline", type: "text", max: 200 },
          { key: "cta_label", label: "WhatsApp button", type: "text", max: 40, hint: "Opens the WhatsApp link from Brand." },
          { key: "cta2_label", label: "Second button", type: "text", max: 40 },
          { key: "cta2_href", label: "Second button goes to", type: "link" },
        ],
      },
      {
        key: "clients",
        title: "Client logos",
        hideable: true,
        fields: [
          { key: "label", label: "Line above the logos", type: "text", max: 120 },
          {
            key: "items",
            label: "Clients",
            type: "list",
            itemTitle: "name",
            blank: { name: "", logo: "", href: "" },
            fields: [
              { key: "name", label: "Name", type: "text", max: 60, hint: "Shown in place of the logo until one is uploaded." },
              { key: "logo", label: "Logo", type: "image", hint: "Transparent PNG, wider than tall. Shown in black and white." },
              { key: "href", label: "Links to", type: "link", hint: "Leave empty for no link." },
            ],
          },
        ],
      },
      {
        key: "services",
        title: "What we do",
        hideable: true,
        fields: [
          ...SECTION_HEAD,
          { key: "cta_label", label: "WhatsApp button", type: "text", max: 40 },
          { key: "go_label", label: "Link text on each card", type: "text", max: 40 },
          {
            key: "cards",
            label: "Cards",
            type: "list",
            fixed: true,
            itemTitle: "title",
            hint: "Each card keeps its picture and its link to the service page.",
            fields: [
              { key: "title", label: "Title", type: "text", max: 60 },
              { key: "text", label: "Text", type: "textarea", max: 220 },
            ],
          },
        ],
      },
      {
        key: "work",
        title: "Selected work",
        hideable: true,
        fields: [
          ...SECTION_HEAD,
          { key: "lead", label: "Intro", type: "textarea", max: 300 },
          { key: "read_label", label: "Link text on each card", type: "text", max: 40 },
          { key: "soon_label", label: "Text on a coming-soon card", type: "text", max: 40 },
          {
            key: "cards",
            label: "Case studies",
            type: "list",
            itemTitle: "title",
            blank: { tag: "", title: "", text: "", href: "", image: "", alt: "", soon: false },
            fields: [
              { key: "title", label: "Client", type: "text", max: 80 },
              { key: "tag", label: "Small label", type: "text", max: 60, hint: "For example: Real estate · Ahmedabad" },
              { key: "text", label: "One line about the work", type: "textarea", max: 220 },
              { key: "image", label: "Picture", type: "image" },
              { key: "alt", label: "Picture description", type: "text", max: 120, hint: "Read out by screen readers." },
              { key: "href", label: "Case study page", type: "link" },
              { key: "soon", label: "Coming soon (no link yet)", type: "toggle" },
            ],
          },
          { key: "all_label", label: "Button under the cards", type: "text", max: 40 },
          { key: "all_href", label: "That button goes to", type: "link" },
        ],
      },
      {
        key: "steps",
        title: "How we work",
        hideable: true,
        fields: [
          ...SECTION_HEAD,
          { key: "lead", label: "Intro", type: "textarea", max: 300 },
          {
            key: "items",
            label: "Steps",
            type: "list",
            fixed: true,
            itemTitle: "title",
            hint: "Each step keeps its drawing.",
            fields: [
              { key: "title", label: "Title", type: "text", max: 60 },
              { key: "text", label: "Text", type: "textarea", max: 260 },
            ],
          },
        ],
      },
      {
        key: "industries",
        title: "Industries",
        hideable: true,
        fields: [
          ...SECTION_HEAD,
          { key: "lead", label: "Intro", type: "textarea", max: 300 },
          {
            key: "items",
            label: "Industries",
            type: "list",
            itemTitle: "label",
            blank: { label: "", client: "", image: "", href: "" },
            fields: [
              { key: "label", label: "Industry", type: "text", max: 60 },
              { key: "client", label: "Client", type: "text", max: 60 },
              { key: "image", label: "Picture", type: "image" },
              { key: "href", label: "Links to", type: "link" },
            ],
          },
        ],
      },
      {
        key: "reels",
        title: "Shoots and reels",
        hideable: true,
        hint: "The reels themselves come from Media, folder home-reels.",
        fields: [
          ...SECTION_HEAD,
          { key: "lead", label: "Intro", type: "textarea", max: 300 },
          { key: "label", label: "Label above the reels", type: "text", max: 40 },
          { key: "link_label", label: "Link beside it", type: "text", max: 60 },
          { key: "link_href", label: "That link goes to", type: "link" },
          { key: "note", label: "Note under the reels", type: "text", max: 200 },
        ],
      },
      {
        key: "faq",
        title: "Questions",
        hideable: true,
        fields: [
          ...SECTION_HEAD,
          {
            key: "items",
            label: "Questions",
            type: "list",
            itemTitle: "q",
            blank: { q: "", a: "" },
            fields: [
              { key: "q", label: "Question", type: "text", max: 160 },
              { key: "a", label: "Answer", type: "textarea", max: 1200 },
            ],
          },
        ],
      },
      {
        key: "cta",
        title: "Closing call to action",
        hint: "The phone number and email come from Brand.",
        fields: [
          ...SECTION_HEAD,
          { key: "text", label: "Text", type: "textarea", max: 300 },
          { key: "button_label", label: "WhatsApp button", type: "text", max: 40 },
          { key: "endnote", label: "Line before the email address", type: "text", max: 120 },
        ],
      },
    ],
  },

  brand: {
    key: "brand",
    title: "Brand",
    path: "/",
    edit: "brand.edit",
    blurb: "Logo, contact details, the header menu and the footer. They show on every page of digitorium.in.",
    sections: [
      {
        key: "",
        title: "Logo and contact",
        fields: [
          { key: "logo", label: "Logo", type: "image", hint: "Used in the header and footer." },
          { key: "phone", label: "Phone number for calls", type: "text", max: 20, hint: "With the country code, no spaces: +917861982524" },
          { key: "phone_display", label: "Phone number as shown", type: "text", max: 30 },
          { key: "email", label: "Email", type: "text", max: 120 },
          { key: "whatsapp_url", label: "WhatsApp link", type: "link", hint: "Used by the WhatsApp buttons on the home page and in the footer." },
          { key: "header_cta_url", label: "Header button link", type: "link" },
          { key: "cta_label", label: "Header button text", type: "text", max: 40 },
        ],
      },
      {
        key: "",
        title: "Header menu",
        hint: "The Services and Work drop-downs. Home, About and Contact stay as they are.",
        fields: [
          {
            key: "menu_services",
            label: "Services",
            type: "list",
            itemTitle: "title",
            blank: { icon: "web", title: "", blurb: "", href: "" },
            fields: [
              { key: "title", label: "Title", type: "text", max: 60 },
              { key: "blurb", label: "Line under it", type: "text", max: 80 },
              { key: "href", label: "Goes to", type: "link" },
              { key: "icon", label: "Icon", type: "select", options: ICONS },
            ],
          },
          {
            key: "menu_work",
            label: "Work",
            type: "list",
            itemTitle: "title",
            blank: { title: "", blurb: "", href: "", image: "" },
            fields: [
              { key: "title", label: "Client", type: "text", max: 60 },
              { key: "blurb", label: "Line under it", type: "text", max: 80 },
              { key: "href", label: "Goes to", type: "link" },
              { key: "image", label: "Thumbnail", type: "image" },
            ],
          },
        ],
      },
      {
        key: "",
        title: "Footer",
        fields: [
          { key: "tagline", label: "Line under the logo", type: "textarea", max: 240 },
          { key: "whatsapp_label", label: "WhatsApp button", type: "text", max: 40 },
          {
            key: "footer_columns",
            label: "Link columns",
            type: "list",
            itemTitle: "heading",
            blank: { heading: "", links: [] },
            fields: [
              { key: "heading", label: "Heading", type: "text", max: 40 },
              {
                key: "links",
                label: "Links",
                type: "list",
                itemTitle: "label",
                blank: { label: "", href: "" },
                fields: [
                  { key: "label", label: "Text", type: "text", max: 60 },
                  { key: "href", label: "Goes to", type: "link" },
                ],
              },
            ],
          },
          { key: "company_line", label: "Company line", type: "text", max: 160 },
          { key: "address", label: "Address", type: "text", max: 200 },
        ],
      },
    ],
  },
};

/* The other pages of the site (Services, Work and the case studies, About,
   Contact, legal pages). Their text stays in the website's code; these
   documents hold only what was changed, as { "<field id>": "new text" }.
   Each page's fields come from lib/site-pages/<key>.json, written by
   scripts/content-slots.js in the website repo: every text, picture and
   link on the page, in page order, under the nearest heading. */
export const SITE_PAGES = PAGE_INDEX;

export async function pageDef(key) {
  const info = PAGE_INDEX.find((p) => p.key === key);
  if (!info) return null;
  const sections = (await import("./site-pages/" + key + ".json")).default;
  return { ...info, edit: "content.edit", slots: sections, blurb: "Every text, picture and link on " + info.path + ". Change a field to replace it on the site; Reset puts the original back." };
}

/* Studio → SEO: per page title, description, share image, canonical and
   "hide from search", plus redirects. SEO_PAGES holds each page's own
   values from its code (lib/site-pages/seo.json); the document stores only
   what the Studio sets on top:
     { pages: { "/about/": { title, description, image, canonical, noindex } },
       redirects: [ { from, to, permanent } ] } */
export const SEO = {
  key: "seo",
  title: "SEO",
  path: "/",
  edit: "brand.edit",
  seo: true,
  pages: SEO_PAGES,
  blurb: "How each page shows in Google and when shared on WhatsApp, LinkedIn or X, plus redirects. Blog posts have their own SEO fields in Posts.",
};
export const SEO_LIMITS = { title: 60, description: 160 };

/* "/page/", "https://…", "tel:…", "mailto:…" or empty. */
export function linkProblem(v) {
  if (!v) return null;
  if (/^\/(?!\/)/.test(v) || /^https?:\/\/[^\s]+$/i.test(v) || /^(tel|mailto):[^\s]+$/i.test(v)) return null;
  return "Start with / for a page on the site, or https:// for another site.";
}

/* Every bad link in a document, as "Section › Field" labels. */
export function problems(doc, def) {
  const out = [];
  function walk(value, fields, where) {
    for (const f of fields) {
      const v = value?.[f.key];
      if (f.type === "link" && linkProblem(v)) out.push(where + f.label);
      if (f.type === "list" && Array.isArray(v)) v.forEach((item, i) => walk(item, f.fields, where + f.label + " " + (i + 1) + " › "));
    }
  }
  if (def.seo) {
    for (const [p, o] of Object.entries(doc?.pages || {})) if (o?.canonical && linkProblem(o.canonical)) out.push("SEO › " + p + " › canonical");
    (doc?.redirects || []).forEach((r, i) => {
      if (!r?.from || !/^\/(?!\/)/.test(r.from)) out.push("Redirect " + (i + 1) + " › from (must start with /)");
      if (!r?.to || linkProblem(r.to)) out.push("Redirect " + (i + 1) + " › to");
    });
    return out;
  }
  if (def.slots) {
    for (const s of def.slots) for (const it of s.items) if (it.link && typeof doc?.[it.id] === "string" && linkProblem(doc[it.id])) out.push(s.title + " › " + it.kind);
    return out;
  }
  for (const s of def.sections) walk(s.key ? doc?.[s.key] : doc, s.fields, s.title + " › ");
  return out;
}

/* JSON with sorted keys: the database reorders keys, so compare this way. */
export function same(a, b) {
  const norm = (x) =>
    Array.isArray(x) ? x.map(norm) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, norm(x[k])])) : x;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export async function fetchDoc(key) {
  const { data, error } = await supabase().from("site_content").select("*").eq("key", key).maybeSingle();
  if (error) throw error;
  return data;
}

/* Saves the draft only if nobody else saved since `since`. Returns the new
   row, or null when someone else got there first. */
export async function saveDraft(key, draft, since) {
  const { data, error } = await supabase()
    .from("site_content")
    .update({ draft })
    .eq("key", key)
    .eq("draft_updated_at", since)
    .select("draft_updated_at, draft_updated_by")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function publishDoc(key) {
  const { error } = await supabase().rpc("publish_site_content", { p_key: key });
  if (error) throw error;
  return refreshSite();
}

export async function fetchVersions(key) {
  const { data, error } = await supabase()
    .from("site_content_versions")
    .select("id, published_at, published_by, note")
    .eq("key", key)
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function restoreVersion(id) {
  const { error } = await supabase().rpc("restore_site_content", { p_version: id });
  if (error) throw error;
  return refreshSite();
}

/* Asks the site to drop its cached text now (app/api/revalidate there).
   true if it did; otherwise pages still update within a minute. */
export async function refreshSite() {
  try {
    const { data } = await supabase().auth.getSession();
    const res = await fetch(SITE_URL + "/api/revalidate", {
      method: "POST",
      headers: { Authorization: "Bearer " + data.session.access_token },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Opens the page on the live site with the drafts showing, in a new tab.
   The site checks the token is a Studio member's (app/api/draft there).
   Synchronous, so the browser treats the new tab as the click's own. */
export function openPreview(path, token) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = SITE_URL + "/api/draft";
  form.target = "_blank";
  for (const [name, value] of [
    ["token", token || ""],
    ["path", path],
  ]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/* Uploads a picture for the site to the public media bucket, returns its URL. */
export async function uploadSiteImage(file) {
  const dot = file.name.lastIndexOf(".");
  const ext = (dot > 0 ? file.name.slice(dot) : ".jpg").toLowerCase();
  const base = (dot > 0 ? file.name.slice(0, dot) : file.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "image";
  const path = "site/" + Date.now().toString(36) + "-" + base + ext;
  const { error } = await supabase().storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return SUPABASE_URL + "/storage/v1/object/public/media/" + path;
}
