/* What each role may do. The database enforces the same rules with RLS
   (supabase/migrations); this file only decides what the screens show. */

export const ROLES = ["owner", "admin", "editor", "viewer"];

export const ROLE_INFO = {
  owner: { label: "Owner", blurb: "Everything, including inviting and removing people." },
  admin: { label: "Admin", blurb: "Everything except managing the team." },
  editor: { label: "Editor", blurb: "Edits pages and media as drafts. No brand, no publishing, no leads." },
  viewer: { label: "Viewer", blurb: "Reads leads. Changes nothing." },
};

const RULES = {
  "leads.read": ["owner", "admin", "viewer"],
  "leads.manage": ["owner", "admin"],
  "media.read": ["owner", "admin", "editor", "viewer"],
  "media.upload": ["owner", "admin", "editor"],
  "media.purge": ["owner", "admin"],
  "team.manage": ["owner"],
  "content.read": ["owner", "admin", "editor"],
  "content.edit": ["owner", "admin", "editor"],
  "brand.edit": ["owner", "admin"],
  "content.publish": ["owner", "admin"],
  "activity.read": ["owner", "admin"],
};

export function can(role, action) {
  return !!role && (RULES[action] || []).includes(role);
}
