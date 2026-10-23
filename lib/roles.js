/* What each role may do. The database enforces the same rules with RLS
   (supabase/migrations); this file only decides what the screens show. */

export const ROLES = ["owner", "admin", "editor", "viewer"];

/* "client" is not a team role: it is a login from client_members, limited
   to that client's own website (see lib/clients.js). */

export const ROLE_INFO = {
  owner: { label: "Owner", blurb: "Everything, including inviting and removing people." },
  admin: { label: "Admin", blurb: "Everything except managing the team." },
  editor: { label: "Editor", blurb: "Edits pages and media as drafts. No brand, no publishing, no leads." },
  viewer: { label: "Viewer", blurb: "Reads leads. Changes nothing." },
  client: { label: "Website editor", blurb: "Edits their own website only." },
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
  "clients.manage": ["owner", "admin"],
  "dipti.edit": ["owner", "admin", "editor", "client"],
  "dipti.delete": ["owner", "admin", "client"],
};

export function can(role, action) {
  return !!role && (RULES[action] || []).includes(role);
}

/* May this person edit that client's website? Staff editors and up may edit
   every client; a client login only its own. */
export function canEditClient(role, myClient, client) {
  if (role === "client") return myClient === client;
  return can(role, "dipti.edit");
}
