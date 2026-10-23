"use client";
/* Sign in with a one-time email link (default) or a password.
   Only emails already in studio_members get a link: shouldCreateUser is
   false here, so strangers cannot create accounts from this page. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudio } from "@/components/StudioProvider";
import { CLIENTS } from "@/lib/clients";

export default function Login() {
  const router = useRouter();
  const { status, hostClient } = useStudio();
  const info = hostClient ? CLIENTS[hostClient] : null;
  const [mode, setMode] = useState("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (status === "ready" || status === "no-access") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    /* a used or expired email link comes back with the reason in the hash */
    const h = new URLSearchParams(window.location.hash.slice(1));
    if (h.get("error_description")) setErr(h.get("error_description").replace(/\+/g, " ") + ". Ask for a new link below.");
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return setErr("Please check the email address.");
    setBusy(true);
    const db = supabase();
    if (mode === "link") {
      const { error } = await db.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/" },
      });
      setBusy(false);
      if (error) {
        /* do not reveal who is on the team: a stranger sees the same message */
        if (/signups not allowed|not found|otp_disabled/i.test(error.message)) return setSent(true);
        return setErr(friendly(error.message));
      }
      setSent(true);
    } else {
      const { error } = await db.auth.signInWithPassword({ email: addr, password });
      setBusy(false);
      if (error) return setErr(friendly(error.message));
      router.replace("/");
    }
  }

  return (
    <main className="auth">
      <div className="authcard">
        {info ? (
          <div className="brand">
            <img src={info.logo} alt={info.name} style={{ width: "auto", height: 40, borderRadius: 0 }} />
            <span className="pill">CMS</span>
          </div>
        ) : (
          <div className="brand">
            <img src="/icon-192.png" alt="" />
            <span>
              Digitorium <span className="grad-text">Studio</span>
            </span>
          </div>
        )}

        {sent ? (
          <div className="authbox">
            <h1>Check your email</h1>
            <p className="muted">
              If <b>{email.trim().toLowerCase()}</b> has access, a sign-in link is on its way. Open it on this device.
            </p>
            <p className="small muted">No email after a few minutes? Check spam, or ask {info ? "Digitorium" : "the owner"} to confirm your invite.</p>
            <button className="linkbtn" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        ) : (
          <form className="authbox" onSubmit={submit} noValidate>
            <div>
              <h1>Sign in</h1>
              <p className="muted small" style={{ marginTop: 4 }}>
                {mode === "link" ? "We will email you a one-time sign-in link." : "Use the password you set in your account."}
              </p>
            </div>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            {mode === "password" ? (
              <label className="field">
                <span>Password</span>
                <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            ) : null}
            {err ? <p className="notice notice--bad">{err}</p> : null}
            <button className="btn btn--solid btn--block" disabled={busy}>
              {busy ? "Please wait…" : mode === "link" ? "Email me a sign-in link" : "Sign in"}
            </button>
            <button type="button" className="linkbtn" onClick={() => (setMode(mode === "link" ? "password" : "link"), setErr(""))}>
              {mode === "link" ? "Sign in with a password instead" : "Forgot it? Email me a link instead"}
            </button>
          </form>
        )}
        <p className="tiny muted" style={{ textAlign: "center" }}>
          {info ? "Website editor for " + info.site.replace("https://", "") + ", by Digitorium." : "Private admin for digitorium.in."} Access is by invitation only.
        </p>
      </div>
    </main>
  );
}

function friendly(msg) {
  if (/invalid login credentials/i.test(msg)) return "That email and password do not match. Try a sign-in link instead.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Too many emails sent just now. Wait a minute and try again.";
  if (/email not confirmed/i.test(msg)) return "Open the link in your invite email first.";
  return msg;
}
