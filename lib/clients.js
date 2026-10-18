/* Client websites the Studio edits besides digitorium.in.

   Each client gets its own sign-in address (portal). Opened there, the
   Studio shows that client's name, logo and colours, and only their
   screens. Who may edit what is decided by the database (client_members
   and client_can_edit() in supabase/migrations), not by this file. */

export const CLIENTS = {
  "dipti-enterprise": {
    name: "Dipti Enterprise",
    short: "Dipti",
    site: "https://diptienterprise.com",
    portal: "https://cms.diptienterprise.com",
    hosts: ["cms.diptienterprise.com"],
    logo: "/clients/dipti-enterprise.webp",
    icon: "/clients/dipti-enterprise-icon.png",
    home: "/dipti",
    accent: { o: "#eb3236", soft: "#f25a4f", deep: "#c9252a" },
  },
};

export function clientForHost(host) {
  const h = (host || "").toLowerCase().split(":")[0];
  return Object.keys(CLIENTS).find((k) => CLIENTS[k].hosts.includes(h)) || null;
}

/* Where a client's invite link should land: their own portal, which has no
   Vercel login in front of it. Locally, stay on this origin. */
export function portalFor(client) {
  if (typeof window !== "undefined" && /^(localhost|127\.)/.test(window.location.hostname)) return window.location.origin;
  return CLIENTS[client]?.portal || window.location.origin;
}
