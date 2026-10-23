"use client";
/* Account: your name, an optional password, sign out. On a phone this is
   also the "More" tab, so it links to the screens the tab bar leaves out. */
import { useState } from "react";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { supabase, SITE_URL } from "@/lib/supabase";
import { can, ROLE_INFO } from "@/lib/roles";
import { CLIENTS } from "@/lib/clients";
import LinkedInCard from "@/components/LinkedInCard";

export default function Account() {
  const { member, email, role, signOut, toast, refreshMember, client } = useStudio();
  const mine = client ? CLIENTS[client] : null;
  const [name, setName] = useState(member?.name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    /* RLS lets only owners edit studio_members, so only owners see this form */
    const { error } = await supabase().from("studio_members").update({ name: name.trim() || null }).eq("email", email);
    if (error) return toast("Only the owner can rename team members.", { bad: true });
    toast("Name saved");
    refreshMember();
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw.length < 8) return toast("Use at least 8 characters.", { bad: true });
    if (pw !== pw2) return toast("The two passwords do not match.", { bad: true });
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(error.message, { bad: true });
    setPw("");
    setPw2("");
    toast("Password saved. You can now sign in with it.");
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{member?.name || email}</h1>
          <p>
            {email} · {ROLE_INFO[role]?.label}
          </p>
        </div>
      </div>

      <section className="card">
        <div className="list">
          {can(role, "content.read") ? (
            <>
              <Link href="/pages" className="row">
                <Icon name="pages" size={18} />
                <div className="grow">
                  <div className="title">Pages</div>
                  <div className="sub">Edit the words on the site</div>
                </div>
              </Link>
              <Link href="/posts" className="row">
                <Icon name="posts" size={18} />
                <div className="grow">
                  <div className="title">Posts</div>
                  <div className="sub">The blog</div>
                </div>
              </Link>
              <Link href="/seo" className="row">
                <Icon name="seo" size={18} />
                <div className="grow">
                  <div className="title">SEO</div>
                  <div className="sub">Google titles, sharing, redirects</div>
                </div>
              </Link>
              <Link href="/brand" className="row">
                <Icon name="brand" size={18} />
                <div className="grow">
                  <div className="title">Brand</div>
                  <div className="sub">Logo, contact details, menu and footer</div>
                </div>
              </Link>
            </>
          ) : null}
          {mine ? (
            <>
              <Link href="/dipti/categories" className="row">
                <Icon name="tag" size={18} />
                <div className="grow">
                  <div className="title">Categories</div>
                  <div className="sub">Product groups and the menu</div>
                </div>
              </Link>
              <Link href="/dipti/reviews" className="row">
                <Icon name="star" size={18} />
                <div className="grow">
                  <div className="title">Reviews</div>
                  <div className="sub">Google reviews shown on the site</div>
                </div>
              </Link>
              <Link href="/dipti/settings" className="row">
                <Icon name="settings" size={18} />
                <div className="grow">
                  <div className="title">Site details</div>
                  <div className="sub">Phone, WhatsApp, address and page text</div>
                </div>
              </Link>
            </>
          ) : (
            <Link href="/users" className="row">
              <Icon name="users" size={18} />
              <div className="grow">
                <div className="title">Team</div>
                <div className="sub">Who has access, and invites</div>
              </div>
            </Link>
          )}
          <a href={mine ? mine.site : SITE_URL} target="_blank" rel="noreferrer" className="row">
            <Icon name="external" size={18} />
            <div className="grow">
              <div className="title">Open {(mine ? mine.site : SITE_URL).replace("https://", "")}</div>
              <div className="sub">The live site</div>
            </div>
          </a>
        </div>
      </section>

      {role === "owner" ? (
        <form className="card" onSubmit={saveName}>
          <h2>Your name</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <div>
            <button className="btn btn--solid">Save name</button>
          </div>
        </form>
      ) : null}

      {can(role, "content.publish") ? <LinkedInCard /> : null}

      <form className="card" onSubmit={savePassword}>
        <div>
          <h2>Password</h2>
          <p className="small muted">Optional. Set one to sign in without waiting for an email link.</p>
        </div>
        <input className="input" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="Repeat it" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <div>
          <button className="btn btn--solid" disabled={busy || !pw}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>

      <section className="card">
        <h2>Install on your phone</h2>
        <p className="small muted">
          iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: open the browser menu and tap Install app.
        </p>
      </section>

      <div>
        <button className="btn btn--danger" onClick={signOut}>
          <Icon name="logout" /> Sign out
        </button>
      </div>
    </div>
  );
}
