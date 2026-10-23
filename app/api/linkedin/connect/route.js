/* POST: an owner or admin starts connecting their LinkedIn profile; the
   reply is the LinkedIn sign-in address to send the browser to.
   DELETE: forget the connected profile. See lib/linkedin-server.js. */
import { NextResponse } from "next/server";
import { authorizeUrl, configured, disconnect, log, memberFrom } from "@/lib/linkedin-server";

async function allowed(req) {
  const m = await memberFrom(req);
  return m && ["owner", "admin"].includes(m.role) ? m : null;
}

export async function POST(req) {
  if (!configured()) return NextResponse.json({ error: "LinkedIn is not set up on the server yet (LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET)." }, { status: 503 });
  const m = await allowed(req);
  if (!m) return NextResponse.json({ error: "Only an owner or admin can connect LinkedIn." }, { status: 403 });
  return NextResponse.json({ url: authorizeUrl(req.nextUrl.origin, m.email) });
}

export async function DELETE(req) {
  const m = await allowed(req);
  if (!m) return NextResponse.json({ error: "Only an owner or admin can disconnect LinkedIn." }, { status: 403 });
  await disconnect();
  await log(m.email, "linkedin.disconnect");
  return NextResponse.json({ ok: true });
}
