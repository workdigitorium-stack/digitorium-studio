"use client";
/* The signed-in frame around every Studio screen: sidebar on desktop,
   tab bar on a phone. It also listens for new leads while the Studio is
   open, shows a toast (and a system notification if allowed), and tells
   any open screen through a "studio:lead" window event. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { supabase } from "@/lib/supabase";
import { can, canEditClient, ROLE_INFO } from "@/lib/roles";
import { CLIENTS } from "@/lib/clients";

const NAV = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/leads", label: "Leads", icon: "leads", need: "leads.read" },
  { href: "/media", label: "Media", icon: "media", need: "media.read" },
  { href: "/pages", label: "Pages", icon: "pages", need: "content.read" },
  { href: "/posts", label: "Posts", icon: "posts", need: "content.read" },
  { href: "/brand", label: "Brand", icon: "brand", need: "content.read" },
  { href: "/seo", label: "SEO", icon: "seo", need: "content.read" },
  { href: "/users", label: "Team", icon: "users" },
  { href: "/account", label: "Account", icon: "account" },
];

/* A client's own screens. Staff see them under that client's name in the
   sidebar; a client login sees only these. */
const CLIENT_NAV = {
  "dipti-enterprise": [
    { href: "/dipti", label: "Overview", icon: "home", exact: true },
    { href: "/dipti/products", label: "Products", icon: "chair" },
    { href: "/dipti/categories", label: "Categories", icon: "tag" },
    { href: "/dipti/gallery", label: "Gallery", icon: "photo" },
    { href: "/dipti/reviews", label: "Reviews", icon: "star" },
    { href: "/dipti/settings", label: "Site details", icon: "settings" },
  ],
};

/* Later phases of the plan, shown so the team knows what is coming. */
const SOON = [];

const CLIENT_NAV_EXACT = new Set(Object.values(CLIENT_NAV).flatMap((g) => g.filter((n) => n.exact).map((n) => n.href)));

function Brand({ info }) {
  return (
    <Link href={info ? info.home : "/"} className="brand">
      {info ? (
        <>
          <img src={info.logo} alt={info.name} style={{ width: "auto", height: 28, borderRadius: 0 }} />
          <span className="pill">CMS</span>
        </>
      ) : (
        <>
          <img src="/icon-192.png" alt="" />
          <span>Studio</span>
        </>
      )}
    </Link>
  );
}

export default function StudioLayout({ children }) {
  const { status, role, member, email, signOut, toast, client, brandClient } = useStudio();
  const router = useRouter();
  const path = usePathname();
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  /* a client login stays on its own screens (the database would show it nothing elsewhere anyway) */
  useEffect(() => {
    if (status !== "ready" || role !== "client") return;
    const own = (CLIENT_NAV[client] || []).some((n) => path === n.href || path.startsWith(n.href + "/"));
    if (!own && path !== "/account") router.replace(CLIENTS[client]?.home || "/account");
  }, [status, role, client, path, router]);

  const refreshCount = useCallback(async () => {
    if (!can(role, "leads.read")) return;
    const db = supabase();
    const [a, b] = await Promise.all([
      db.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      db.from("client_questionnaires").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    setNewCount((a.count || 0) + (b.count || 0));
  }, [role]);

  useEffect(() => {
    if (status !== "ready" || !can(role, "leads.read")) return;
    refreshCount();
    const onChange = () => refreshCount();
    window.addEventListener("studio:leads-changed", onChange);

    const db = supabase();
    const channel = db
      .channel("studio-leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => announce("lead", p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_questionnaires" }, (p) => announce("questionnaire", p.new))
      .subscribe();

    function announce(kind, row) {
      const who = kind === "lead" ? row.name : row.contact_name + " (" + row.business_name + ")";
      const what = kind === "lead" ? "New lead" : "New discovery form";
      toast(what + ": " + who, { href: "/leads?open=" + kind + ":" + row.id, action: "View", ms: 8000 });
      try {
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification(what, { body: who, icon: "/icon-192.png", tag: kind + row.id });
        }
      } catch (e) {
        /* some browsers only allow notifications from the service worker */
      }
      window.dispatchEvent(new CustomEvent("studio:lead", { detail: { kind, row } }));
      refreshCount();
    }

    return () => {
      window.removeEventListener("studio:leads-changed", onChange);
      db.removeChannel(channel);
    };
  }, [status, role, refreshCount, toast]);

  if (status === "loading" || status === "signed-out") {
    return (
      <div className="splash">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (status === "no-access") {
    return (
      <main className="auth">
        <div className="authcard">
          <div className="authbox">
            <h1>No access yet</h1>
            <p className="muted">
              You are signed in as <b>{email}</b>, but this email has no access yet. Ask {brandClient ? "Digitorium" : "the owner"} to invite this exact address.
            </p>
            <button className="btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const clientNav = Object.keys(CLIENT_NAV)
    .filter((k) => canEditClient(role, client, k))
    .map((k) => ({ client: k, items: CLIENT_NAV[k] }));
  /* a client login gets only their own screens; on a client's portal staff see that client first */
  const nav =
    role === "client"
      ? clientNav.flatMap((g) => g.items).concat({ href: "/account", label: "Account", icon: "account" })
      : NAV.filter((n) => !n.need || can(role, n.need));
  const groups = role === "client" ? [] : clientNav;
  const isOn = (href) => (href === "/" ? path === "/" : CLIENT_NAV_EXACT.has(href) ? path === href : path.startsWith(href));
  const tabs =
    role === "client" || (brandClient && groups.length)
      ? (role === "client" ? nav : groups.find((g) => g.client === brandClient)?.items || nav)
          .filter((n) => n.href !== "/account" && n.href !== "/dipti/categories" && n.href !== "/dipti/reviews")
          .slice(0, 4)
          .concat({ href: "/account", label: "More", icon: "more" })
      : nav.filter((n) => n.href !== "/account").slice(0, 4).concat({ href: "/account", label: "More", icon: "more" });
  const brandInfo = brandClient ? CLIENTS[brandClient] : null;
  const viewSite = brandInfo ? brandInfo.site : "https://digitorium.in";

  return (
    <div className="shell">
      <aside className="side">
        <Brand info={brandInfo} />
        <nav className="nav" aria-label="Studio">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""}>
              <Icon name={n.icon} />
              {n.label}
              {n.href === "/leads" && newCount > 0 ? <span className="badge">{newCount}</span> : null}
            </Link>
          ))}
          {groups.map((g) => (
            <div key={g.client} style={{ display: "contents" }}>
              <div className="navlabel">{CLIENTS[g.client].name}</div>
              {g.items.map((n) => (
                <Link key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""}>
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              ))}
            </div>
          ))}
          {SOON.length ? <div className="navlabel">Coming next</div> : null}
          {SOON.map((n) => (
            <span key={n.label} className="navitem" title="Planned for a later phase">
              <Icon name={n.icon} />
              {n.label}
              <span className="pill pill--soon">Soon</span>
            </span>
          ))}
        </nav>
        <div className="me">
          <Link href="/account">{member?.name || email}</Link>
          <span className="muted tiny">{ROLE_INFO[role]?.label}</span>
        </div>
      </aside>

      <header className="topbar">
        <Brand info={brandInfo} />
        <a href={viewSite} target="_blank" rel="noreferrer" className="btn btn--sm">
          View site <Icon name="external" />
        </a>
      </header>

      <main className="main">{children}</main>

      <nav className="tabs" aria-label="Studio" style={{ gridTemplateColumns: "repeat(" + tabs.length + ", 1fr)" }}>
        {tabs.map((n) => (
          <Link key={n.label} href={n.href} className={"tab" + (isOn(n.href) ? " on" : "")}>
            <Icon name={n.icon} />
            {n.label}
            {n.href === "/leads" && newCount > 0 ? <span className="badge">{newCount}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
