/* LinkedIn sends the browser back here after the person allows (or
   declines) access. Stores the connection, then returns to Account. */
import { NextResponse } from "next/server";
import { connect, log, readState } from "@/lib/linkedin-server";

export async function GET(req) {
  const q = req.nextUrl.searchParams;
  const back = (result) => NextResponse.redirect(new URL("/account?linkedin=" + result, req.nextUrl.origin));
  const state = readState(q.get("state"));
  if (!state) return back("expired");
  if (q.get("error") || !q.get("code")) return back("declined");
  try {
    const name = await connect(req.nextUrl.origin, q.get("code"), state.email);
    await log(state.email, "linkedin.connect", name);
    return back("connected");
  } catch (e) {
    console.error("LinkedIn connect failed:", e);
    return back("failed");
  }
}
