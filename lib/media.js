/* The media library is the live site's public Supabase "videos" bucket:
     videos/<client>/<section>/<file>
   The site (app/components/media.js in the website repo) reads these
   folders about once a minute, so an upload or delete here shows on
   digitorium.in within a minute. Its rules, which the Studio keeps:
     - name.mp4 is a video; name.jpg/.png/.webp beside it is its cover
     - an image with no matching mp4 is a photo
     - backdrop.jpg/.png/.webp is a section's background, never a tile
   Deleting moves a file to videos/_bin/<client>/<section>/<time>~<file>.
   The site never reads _bin, and a file can be restored from there for
   30 days before it is removed for good. */
import { supabase, SUPABASE_URL } from "./supabase";

export const BUCKET = "videos";
export const BIN = "_bin";
export const BIN_DAYS = 30;

/* Where each section shows on the site. A folder not listed here still works. */
export const SECTIONS = {
  "home-hero": "Home page hero video wall",
  "home-reels": "Home page reels row",
  "services-page": "Services page",
  "ads-page": "Services: Meta and Google ads",
  "shoots-page": "Services: Photo and video shoots",
  "shoots-reels": "Services: shoots reel strip",
  "case-study": "That client's case study page",
  "work-page": "Work page hero photo",
  about: "About page photo",
};

export const CLIENTS = {
  "highmark-realty": "Highmark Realty",
  naarie: "Naarie",
  "svj-archinterio": "SVJ ArchInterió",
  "sociafi-media": "Sociafi Media",
  "classic-exclusive": "Classic Exclusive",
  "devi-logistics": "Devi Logistics",
  "riddhi-makeup-studio": "Riddhi Makeup Studio",
};

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;
export const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4";

export function publicUrl(path) {
  return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/");
}

export function clientName(slug) {
  return CLIENTS[slug] || slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function list(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase().storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    out.push(...data.filter((x) => x.name !== ".emptyFolderPlaceholder"));
    if (data.length < 1000) return out;
  }
}
const isFolder = (x) => x.id === null;

/* Every file in the library (bin excluded), walking client and section folders. */
export async function fetchLibrary() {
  const clients = (await list("")).filter((x) => isFolder(x) && x.name !== BIN);
  const sections = await Promise.all(
    clients.map(async (c) => (await list(c.name)).filter(isFolder).map((s) => ({ client: c.name, section: s.name }))),
  );
  const files = await Promise.all(
    sections.flat().map(async ({ client, section }) =>
      (await list(client + "/" + section)).filter((x) => !isFolder(x)).map((f) => toFile(client, section, f)),
    ),
  );
  return { files: files.flat(), folders: sections.flat() };
}

function toFile(client, section, f) {
  const path = client + "/" + section + "/" + f.name;
  const dot = f.name.lastIndexOf(".");
  return {
    path,
    client,
    section,
    file: f.name,
    base: dot > 0 ? f.name.slice(0, dot) : f.name,
    type: VIDEO.test(f.name) ? "video" : IMAGE.test(f.name) ? "image" : "other",
    size: f.metadata?.size,
    created_at: f.created_at,
    url: publicUrl(path),
  };
}

/* Groups files the way the site shows them: a video with its cover is one
   item; a lone image is a photo; backdrop is the section background. */
export function groupItems(files) {
  const groups = new Map();
  for (const f of files) {
    const k = f.client + "/" + f.section + "/" + f.base;
    if (!groups.has(k)) groups.set(k, { key: k, client: f.client, section: f.section, name: f.base, files: [] });
    groups.get(k).files.push(f);
  }
  const items = [];
  for (const g of groups.values()) {
    const video = g.files.find((f) => f.type === "video");
    const image = g.files.find((f) => f.type === "image");
    const backdrop = g.name.toLowerCase() === "backdrop";
    items.push({
      ...g,
      kind: backdrop ? "backdrop" : video ? "video" : image ? "photo" : "other",
      src: (video || image || g.files[0]).url,
      poster: video && image ? image.url : null,
      video,
      cover: video ? image : null,
      size: g.files.reduce((n, f) => n + (f.size || 0), 0),
      created_at: g.files.map((f) => f.created_at).sort()[0],
    });
  }
  return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/* A storage name that will not clash with what is already in the folder. */
export function uniqueName(base, ext, taken) {
  let name = base + ext;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = base + "-" + i + ext;
  taken.add(name.toLowerCase());
  return name;
}

export async function upload(path, file) {
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, cacheControl: "3600", upsert: false });
  if (error) throw error;
}

export async function move(from, to) {
  const { error } = await supabase().storage.from(BUCKET).move(from, to);
  if (error) throw error;
}

/* Soft delete: into the bin, stamped with the time it was deleted. */
export async function toBin(path) {
  await move(path, BIN + "/" + path.replace(/\/([^/]+)$/, "/" + Date.now() + "~$1"));
}

export async function fetchBin() {
  const clients = (await list(BIN)).filter(isFolder);
  const sections = await Promise.all(
    clients.map(async (c) => (await list(BIN + "/" + c.name)).filter(isFolder).map((s) => ({ client: c.name, section: s.name }))),
  );
  const files = await Promise.all(
    sections.flat().map(async ({ client, section }) =>
      (await list(BIN + "/" + client + "/" + section)).filter((x) => !isFolder(x)).map((f) => {
        const m = /^(\d+)~(.+)$/.exec(f.name);
        const original = m ? m[2] : f.name;
        const path = BIN + "/" + client + "/" + section + "/" + f.name;
        return {
          path,
          client,
          section,
          file: original,
          restoreTo: client + "/" + section + "/" + original,
          deleted_at: m ? new Date(Number(m[1])).toISOString() : f.updated_at || f.created_at,
          type: VIDEO.test(original) ? "video" : IMAGE.test(original) ? "image" : "other",
          size: f.metadata?.size,
          url: publicUrl(path),
        };
      }),
    ),
  );
  return files.flat().sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1));
}

export async function purge(paths) {
  if (!paths.length) return;
  const { error } = await supabase().storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

export function isExpired(binFile) {
  return Date.now() - new Date(binFile.deleted_at).getTime() > BIN_DAYS * 86400000;
}
