"use client";
/* Dashboard: today's leads, what still needs a reply, recent changes. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { supabase, SITE_URL } from "@/lib/supabase";
import { can } from "@/lib/roles";
import { fetchLeads, sourceLabel, statusLabel } from "@/lib/leads";
import { fetchLibrary, groupItems, clientName } from "@/lib/media";
import { startOfTodayIST, timeAgo } from "@/lib/format";

export default function Dashboard() {
  const { role, member, email } = useStudio();
  const [leads, setLeads] = useState(null);
  const [media, setMedia] = useState(null);
  const [activity, setActivity] = useState(null);
  const [notif, setNotif] = useState("default");

  const load = useCallback(async () => {
    const jobs = [];
    if (can(role, "leads.read")) jobs.push(fetchLeads({ limit: 200 }).then(setLeads, () => setLeads([])));
    if (can(role, "media.read")) jobs.push(fetchLibrary().then((r) => setMedia(groupItems(r.files)), () => setMedia([])));
    if (can(role, "activity.read"))
      jobs.push(
        supabase()
          .from("studio_activity")
          .select("*")
          .order("at", { ascending: false })
          .limit(8)
          .then(({ data }) => setActivity(data || [])),
      );
    await Promise.all(jobs);
  }, [role]);

  useEffect(() => {
    load();
    if ("Notification" in window) setNotif(Notification.permission);
    const on = () => load();
    window.addEventListener("studio:lead", on);
    return () => window.removeEventListener("studio:lead", on);
  }, [load]);

  const today = startOfTodayIST();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const firstName = (member?.name || email || "").split(/[ @]/)[0];

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Hello{firstName ? ", " + firstName : ""}</h1>
          <p>Everything on digitorium.in, in one place.</p>
        </div>
        <div className="actions">
          <a className="btn" href={SITE_URL} target="_blank" rel="noreferrer">
            Open the live site <Icon name="external" />
          </a>
          {can(role, "media.upload") ? (
            <Link className="btn btn--solid" href="/media?upload=1">
              <Icon name="upload" /> Upload media
            </Link>
          ) : null}
        </div>
      </div>

      {can(role, "leads.read") && notif === "default" ? (
        <div className="notice" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Icon name="bell" size={18} />
          <span style={{ flex: 1, minWidth: 200 }}>Get an alert on this device when a new lead arrives while the Studio is open.</span>
          <button className="btn btn--sm" onClick={() => Notification.requestPermission().then(setNotif)}>
            Turn on alerts
          </button>
        </div>
      ) : null}

      <div className="stats">
        {can(role, "leads.read") ? (
          <>
            <Link href="/leads?status=new" className="stat hot">
              <b>{leads ? leads.filter((l) => l.status === "new").length : "–"}</b>
              <span>Leads waiting for a reply</span>
            </Link>
            <Link href="/leads" className="stat">
              <b>{leads ? leads.filter((l) => l.created_at >= today).length : "–"}</b>
              <span>New today</span>
            </Link>
            <Link href="/leads" className="stat">
              <b>{leads ? leads.filter((l) => l.created_at >= weekAgo).length : "–"}</b>
              <span>Last 7 days</span>
            </Link>
          </>
        ) : null}
        {can(role, "media.read") ? (
          <Link href="/media" className={"stat" + (can(role, "leads.read") ? "" : " hot")}>
            <b>{media ? media.filter((m) => m.kind !== "backdrop").length : "–"}</b>
            <span>Photos and videos live</span>
          </Link>
        ) : null}
      </div>

      <div className="grid2">
        {can(role, "leads.read") ? (
          <section className="card">
            <div className="cardhead">
              <h2>Latest leads</h2>
              <Link href="/leads">All leads</Link>
            </div>
            {!leads ? (
              <div className="spinner" />
            ) : leads.length === 0 ? (
              <div className="empty">
                <Icon name="inbox" />
                <p>No leads yet. Popup, contact and discovery form entries will land here.</p>
              </div>
            ) : (
              <div className="list">
                {leads.slice(0, 6).map((l) => (
                  <Link key={l.key} href={"/leads?open=" + l.key} className="row">
                    <div className="avatar">{(l.name || "?").charAt(0).toUpperCase()}</div>
                    <div className="grow">
                      <div className="title">{l.name}</div>
                      <div className="sub">
                        {sourceLabel(l.source)} · {timeAgo(l.created_at)}
                      </div>
                    </div>
                    <span className={"pill pill--" + l.status}>{statusLabel(l.status)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {can(role, "media.read") ? (
          <section className="card">
            <div className="cardhead">
              <h2>Recently uploaded</h2>
              <Link href="/media">Media library</Link>
            </div>
            {!media ? (
              <div className="spinner" />
            ) : (
              <div className="list">
                {media
                  .filter((m) => m.kind !== "backdrop")
                  .slice(0, 5)
                  .map((m) => (
                    <Link key={m.key} href={"/media?folder=" + encodeURIComponent(m.client + "/" + m.section)} className="row">
                      <div className="avatar" style={{ borderRadius: 8, overflow: "hidden", background: "var(--line2)" }}>
                        {m.kind === "photo" || m.poster ? <img src={m.poster || m.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="video" size={16} />}
                      </div>
                      <div className="grow">
                        <div className="title">{m.name}</div>
                        <div className="sub">
                          {clientName(m.client)} · {m.section} · {timeAgo(m.created_at)}
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </section>
        ) : null}

        {can(role, "activity.read") ? (
          <section className="card">
            <div className="cardhead">
              <h2>Recent activity</h2>
            </div>
            {!activity ? (
              <div className="spinner" />
            ) : activity.length === 0 ? (
              <p className="muted small">Uploads, deletes, invites and lead updates will be listed here.</p>
            ) : (
              <div className="list">
                {activity.map((a) => (
                  <div key={a.id} className="row">
                    <Icon name="activity" size={16} style={{ color: "var(--faint)", flex: "none" }} />
                    <div className="grow">
                      <div className="title" style={{ fontWeight: 400 }}>
                        <b style={{ fontWeight: 600 }}>{a.actor.split("@")[0]}</b> {describe(a)}
                      </div>
                      <div className="sub">{timeAgo(a.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="card card--warm">
          <div className="cardhead">
            <h2>What the Studio does today</h2>
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, color: "var(--ink2)" }}>
            <li>Every lead from the popup, contact form and discovery form, with status and notes.</li>
            <li>The photo and video library behind the site. Uploads go live within a minute.</li>
            <li>Team access by email invite, with Owner, Admin, Editor and Viewer roles.</li>
          </ul>
          <p className="small muted">Page text, brand, SEO and posts come in the next phases.</p>
        </section>
      </div>
    </div>
  );
}

const VERBS = {
  "media.upload": "uploaded",
  "media.delete": "moved to the bin",
  "media.restore": "restored",
  "media.purge": "permanently deleted",
  "media.rename": "renamed",
  "lead.status": "updated a lead:",
  "lead.notes": "added notes to",
  "lead.delete": "deleted a lead:",
  "team.invite": "invited",
  "team.role": "changed the role of",
  "team.remove": "removed",
};
function describe(a) {
  return (VERBS[a.action] || a.action) + " " + (a.target || "");
}
