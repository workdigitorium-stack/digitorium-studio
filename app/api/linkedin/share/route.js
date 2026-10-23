/* Shares live posts that ask for it and are not on LinkedIn yet.
   POST: from the Studio (any member) after a publish, or when Posts opens,
   so scheduled posts go out soon after their time. { retry: <post id> }
   from an owner or admin first clears that post's last error.
   GET: Vercel's daily cron (vercel.json), in case nobody opens the Studio. */
import { NextResponse } from "next/server";
import { clearError, configured, memberFrom, shareDue } from "@/lib/linkedin-server";

export async function POST(req) {
  const m = await memberFrom(req);
  if (!m) return NextResponse.json({ error: "Sign in to the Studio first." }, { status: 401 });
  if (!configured()) return NextResponse.json({ shared: 0, waiting: "not set up" });
  const body = await req.json().catch(() => ({}));
  if (body.retry && ["owner", "admin"].includes(m.role)) await clearError(String(body.retry));
  return run();
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  if (!configured()) return NextResponse.json({ shared: 0, waiting: "not set up" });
  return run();
}

async function run() {
  try {
    return NextResponse.json(await shareDue());
  } catch (e) {
    console.error("LinkedIn share run failed:", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 500 });
  }
}
