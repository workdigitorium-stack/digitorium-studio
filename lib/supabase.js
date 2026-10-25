/* One Supabase client for the whole Studio, used in the browser.

   The Studio holds no secrets. It signs people in with Supabase Auth and
   every read and write goes through row level security, which checks the
   signed-in email against public.studio_members (see supabase/migrations). */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://piqzapryetvfwonreova.supabase.co";
/* publishable key: safe in the browser, RLS decides what it can do */
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_q5eQmyxnrojz94q7v2lrEQ_Y9v_7L4i";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.digitorium.in";

let client;
export function supabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      /* implicit, not PKCE: an invite link is requested from the owner's
         browser but opened in the invitee's, which PKCE cannot complete */
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    });
  }
  return client;
}

/* Write one line to the activity log. Never blocks or breaks the action it records. */
export async function logActivity(action, target, details) {
  try {
    await supabase().from("studio_activity").insert({ action, target: target ? String(target).slice(0, 300) : null, details: details || null });
  } catch (e) {
    /* logging is best effort */
  }
}
