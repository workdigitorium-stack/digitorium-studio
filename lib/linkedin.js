/* LinkedIn sharing, as the screens see it. The token and the posting live
   on the Studio's server (app/api/linkedin, lib/linkedin-server.js); this
   only asks it to act, and reads who is connected (never the token). */
import { supabase } from "./supabase";

/* { name, expires_at, connected_by, connected_at }, or null if none */
export async function linkedinStatus() {
  const { data, error } = await supabase().rpc("linkedin_status");
  if (error) throw error;
  return data?.[0] || null;
}

/* Days left on the connection. LinkedIn makes it last 60 days. */
export function daysLeft(status) {
  return status ? Math.floor((new Date(status.expires_at) - Date.now()) / 86400000) : -1;
}

async function call(method, body) {
  const { data } = await supabase().auth.getSession();
  const res = await fetch("/api/linkedin/" + (method === "SHARE" ? "share" : "connect"), {
    method: method === "SHARE" ? "POST" : method,
    headers: { Authorization: "Bearer " + data.session?.access_token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Something went wrong (" + res.status + ").");
  return out;
}

/* Sends the browser to LinkedIn to allow access; it comes back to /account. */
export async function connectLinkedIn() {
  const { url } = await call("POST");
  window.location.href = url;
}

export function disconnectLinkedIn() {
  return call("DELETE");
}

/* Shares every live post that is waiting. retry: a failed post's id to try again. */
export function shareDue(retry) {
  return call("SHARE", retry ? { retry } : {});
}

export function linkedinPostUrl(urn) {
  return "https://www.linkedin.com/feed/update/" + urn + "/";
}
