"use client";
/* Team: who can sign in, with which role. Only owners change it.

   Inviting adds the email to studio_members and sends that address a
   one-time sign-in link. Opening it creates their account; they can set
   a password later under Account. */
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { supabase, logActivity } from "@/lib/supabase";
import { can, ROLES, ROLE_INFO } from "@/lib/roles";
import { timeAgo } from "@/lib/format";

export default function Team() {
  const { role, email: me, toast } = useStudio();
  const [members, setMembers] = useState(null);
  const [inviting, setInviting] = useState(false);
  const isOwner = can(role, "team.manage");

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("studio_members").select("*").order("created_at");
    if (error) toast("Could not load the team: " + error.message, { bad: true });
    setMembers(data || []);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(m, next) {
    const { error } = await supabase().from("studio_members").update({ role: next }).eq("email", m.email);
    if (error) return toast(friendly(error.message), { bad: true });
    logActivity("team.role", m.email + " → " + ROLE_INFO[next].label);
    toast(m.email + " is now " + ROLE_INFO[next].label);
    load();
  }

  async function remove(m) {
    if (!confirm("Remove " + m.email + " from the Studio? They lose access straight away.")) return;
    const { error } = await supabase().from("studio_members").delete().eq("email", m.email);
    if (error) return toast(friendly(error.message), { bad: true });
    logActivity("team.remove", m.email);
    toast(m.email + " removed");
    load();
  }

  async function resend(m) {
    const { error } = await sendLink(m.email);
    if (error) return toast(friendly(error.message), { bad: true });
    toast("Sign-in link sent to " + m.email);
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Team</p>
          <h1>Who has access</h1>
          <p>{isOwner ? "Invite people by email and choose what they can do." : "Only the owner can invite or remove people."}</p>
        </div>
        {isOwner ? (
          <div className="actions">
            <button className="btn btn--solid" onClick={() => setInviting(true)}>
              <Icon name="plus" /> Invite someone
            </button>
          </div>
        ) : null}
      </div>

      <section className="card" style={{ padding: "6px 14px" }}>
        {!members ? (
          <div className="empty">
            <div className="spinner" />
          </div>
        ) : (
          <div className="list">
            {members.map((m) => (
              <div key={m.email} className="row" style={{ flexWrap: "wrap" }}>
                <div className="avatar">{(m.name || m.email).charAt(0).toUpperCase()}</div>
                <div className="grow" style={{ minWidth: 180 }}>
                  <div className="title">
                    {m.name || m.email.split("@")[0]}
                    {m.email === me ? <span className="muted" style={{ fontWeight: 400 }}> (you)</span> : null}
                  </div>
                  <div className="sub">
                    {m.email} · {m.last_seen_at ? "active " + timeAgo(m.last_seen_at) : "has not signed in yet"}
                  </div>
                </div>
                {isOwner ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select className="select" style={{ minHeight: 34, padding: "4px 30px 4px 10px", fontSize: 13, width: "auto" }} value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label={"Role for " + m.email}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_INFO[r].label}
                        </option>
                      ))}
                    </select>
                    {!m.last_seen_at ? (
                      <button className="btn btn--sm" onClick={() => resend(m)} title="Send the sign-in link again">
                        <Icon name="mail" /> Resend
                      </button>
                    ) : null}
                    {m.email !== me ? (
                      <button className="btn btn--sm btn--icon btn--danger" onClick={() => remove(m)} aria-label={"Remove " + m.email}>
                        <Icon name="trash" />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="pill">{ROLE_INFO[m.role]?.label}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card card--warm">
        <h2>What each role can do</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["", "Owner", "Admin", "Editor", "Viewer"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Upload and edit media", "Yes", "Yes", "Yes", "No"],
                ["See and manage leads", "Yes", "Yes", "No", "Read only"],
                ["Empty the media bin", "Yes", "Yes", "No", "No"],
                ["Invite or remove people", "Yes", "No", "No", "No"],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line2)", color: c === "Yes" ? "var(--ok)" : i ? "var(--muted)" : "var(--ink)", fontWeight: c === "Yes" ? 600 : 400 }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {inviting ? <InviteSheet onClose={() => setInviting(false)} onDone={load} /> : null}
    </div>
  );
}

function sendLink(email) {
  /* shouldCreateUser: the invitee has no account until they open this link */
  return supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + "/" } });
}

function InviteSheet({ onClose, onDone }) {
  const { email: me, toast } = useStudio();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return setErr("Please check the email address.");
    setBusy(true);
    setErr("");
    const { error } = await supabase()
      .from("studio_members")
      .insert({ email: addr, name: name.trim() || null, role, invited_by: me });
    if (error) {
      setBusy(false);
      return setErr(/duplicate|already exists/i.test(error.message) ? "That email is already on the team." : friendly(error.message));
    }
    logActivity("team.invite", addr + " as " + ROLE_INFO[role].label);
    const sent = await sendLink(addr);
    setBusy(false);
    onDone();
    onClose();
    if (sent.error) toast("Added " + addr + ", but the email did not send (" + friendly(sent.error.message) + "). Use Resend in a minute.", { bad: true, ms: 9000 });
    else toast("Invite sent to " + addr);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="Invite someone" onSubmit={submit} noValidate>
        <div className="sheethead">
          <div>
            <p className="eyebrow">Invite</p>
            <h2>Add someone to the Studio</h2>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Name (optional)</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <div className="field">
          <span>Role</span>
          <div style={{ display: "grid", gap: 6 }}>
            {ROLES.map((r) => (
              <label key={r} className="row" style={{ border: "1px solid " + (role === r ? "var(--o-soft)" : "var(--line)"), borderRadius: 10, padding: "9px 12px", cursor: "pointer", background: role === r ? "var(--bg2)" : "#fff" }}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <div className="grow">
                  <div className="title">{ROLE_INFO[r].label}</div>
                  <div className="sub" style={{ whiteSpace: "normal" }}>
                    {ROLE_INFO[r].blurb}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        {err ? <p className="notice notice--bad">{err}</p> : null}
        <p className="small muted">They get an email with a one-time sign-in link. They can set a password afterwards.</p>
        <div className="btnrow end">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--solid" disabled={busy}>
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}

function friendly(msg) {
  if (/at least one owner/i.test(msg)) return "The Studio needs at least one owner. Make someone else an owner first.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "email limit reached, wait a minute";
  if (/row-level security/i.test(msg)) return "Only the owner can change the team.";
  return msg;
}
